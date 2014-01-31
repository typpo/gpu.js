
;function GpuWorker() {

  var me = this;
  var resultOffset = 0;

  var pow2 = [4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

  me.prepare = function(id) {
    return me.prepareString(document.getElementById(id).innerHTML);
  };

  me.setResultRange = function(min, max) {
    resultOffset = Math.max(Math.abs(min), Math.abs(max));
  };

  me.prepareString  = function(glsl_str) {
    var length = -1;
    var pad = 0;
    var webCLGL = new WebCLGL();

    return function() {
      var args = Array.prototype.slice.call(arguments);
      var buffers = [];

      for (var i=0; i < args.length; i++) {
        var arg = args[i];

        if (Object.prototype.toString.call(arg) !== '[object Array]') {

          if (typeof arg === 'Number') {
            // Special case.  It's a constant
            buffers[i] = arg;
            continue;
          } else {
            console.error('Arguments must be array types');
            return false;
          }
        }

        if (length < 0) {
          // Length requirement not set yet
          length = arg.length;
          if (!isPow2(length) || length < 4) {
            // Calculate amount of padding
            // need to pad if it's not a power of 2!  Or less than 4
            var nextPow2 = -1;
            for (var j=0; j < pow2.length; j++) {
              var pp = pow2[j];
              if (pp >= length) {
                pad = pp - length;
                break;
              }
            }
            if (pad < 0) {
              // Failed, maybe because this is a really long list
              // User is responsible for enforcing power of 2 now
              console.error('Array arguments must be a power of 2 in length');
              return false;
            }
          }
        } else if (arg.length !== length) {
          console.error('Required length', length, 'but got', arg.length + pad);
          console.log('For arg:', arg);
          return false;
        }

        if (pad > 0) {
          // Pad to power of 2 length
          for (var j=0; j < pad; j++) {
            arg.push(0);
          }
        }

        var offset = 0;
        // offset is set dynamically based on range
        var min = Number.MAX_VALUE;
        var max = Number.MIN_VALUE;

        if (typeof arg[0] === 'number') {
          // It's an array of floats
          for (var j=0; j < arg.length; j++) {
            var tmpj = arg[j];
            min = Math.min(tmpj, min);
            max = Math.max(tmpj, max);
          }
          offset = Math.max(Math.abs(min), Math.abs(max));
          buffers[i] = webCLGL.createBuffer(length, 'FLOAT', offset);
          webCLGL.enqueueWriteBuffer(buffers[i], arg);
          console.log('queueing', arg);

        } else if (Object.prototype.toString.call(arg) === '[object Array]') {
          // It's an array of float4s, so flatten it and create a buffer
          var flat = [];
          for (var j=0; j < arg.length; j++) {
            var subarr = arg[j];
            if (subarr.length != 4) {
              console.error('Only float4s are supported.  Make sure each subarray has exactly 4 values.');
              return false;
            }
            min = Math.min(subarr, min);
            max = Math.max(subarr, max);
            flat.concat(subarr);
          }
          offset = Math.max(Math.abs(min), Math.abs(max));
          buffers[i] = webCLGL.createBuffer(length, 'FLOAT4', offset);
          webCLGL.enqueueWriteBuffer(buffers[i], flat);
        }
      }  // end for

      console.log(glsl_str);
      var kernel_add = webCLGL.createKernel(glsl_str);
      console.log(buffers);
      for (var i=0; i < args.length; i++) {
        kernel_add.setKernelArg(i, buffers[i]);
      }
      kernel_add.compile();

      // TODO get result, either an array of floats or an array of float4s
      // TODO Final offset can't really be predicted
      var buffer_ret = webCLGL.createBuffer(length+pad, 'FLOAT', resultOffset);
      webCLGL.enqueueNDRangeKernel(kernel_add, buffer_ret);

      var result = webCLGL.enqueueReadBuffer_Float(buffer_ret);
      return result;
    };
  };

  function isPow2(n) {
    return n != 0 && (n & (n - 1) == 0)
  }

};
