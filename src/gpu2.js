
;function GpuWorker() {

  var me = this;
  var webCLGL = new WebCLGL();
  var resultOffset = 0;

  me.prepare = function(id) {
    return me.prepareString(document.getElementById(id));
  };

  me.setResultOffset = function(val) {
    resultOffset = val;
  };

  me.prepareString  = function(glsl_str) {
    var length = -1;

    return function() {
      var args = arguments;
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
          // Set length requirement
          length = arg.length;
        } else if (arg.length !== length) {
          console.error('Required length', length);
          return false;
        }

        var offset = 0;
        // offset is set dynamically based on range
        var min = Number.MAX_VALUE;
        var max = Number.MIN_VALUE;

        if (typeof arg[0] == 'Number') {
          // It's an array of floats
          for (var j=0; j < arg.length; j++) {
            var tmpj = arg[j];
            min = Math.min(tmpj, min);
            max = Math.max(tmpj, max);
          }
          offset = Math.max(Math.abs(min), Math.abs(max));
          buffers[i] = webCLGL.createBuffer(length, 'FLOAT', offset);
          webCLGL.enqueueWriteBuffer(buffers[i], arg);

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

      var kernel_add = webCLGL.createKernel(glsl_str);
      for (var i=0; i < args.length; i++) {
        kernel_add.setKernelArg(i, buffers[i]);
      }
      kernel_add.compile();

      // TODO get result, either an array of floats or an array of float4s
      // TODO Final offset can't really be predicted
      var buffer_ret = WebCLGL.createBuffer(length, 'FLOAT', resultOffset);
      webCLGL.enqueueNDRangeKernel(kernel_add, buffer_ret);

      var result = webCLGL.enqueueReadBuffer_Float(buffer_C);
      return result;
    };
  };

};
