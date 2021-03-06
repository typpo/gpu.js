//
// gpu.js - a gpgpu library in JavaScript
//
// Ian Webster, MIT License
//

;function Gpu() {
  var me = this;

  var gl;
  var TEX_WIDTH = 128;
  var TEX_HEIGHT = 128;
  var RANGE = 1000;

  var textureA, textureB, plane;

  var renderShader, updateShader, encodeShader1;

  var outputConverted, outputTexture, outputStorage;

  me.Init = function() {
    if (typeof GL === 'undefined') {
      console.error('gpu.js depends on the LightGL library.');
      return false;;
    }
    gl = GL.create({ alpha: true });
    if (!gl.getExtension('OES_texture_float')) {
      console.error('gpu.js requires the OES_texture_float extension');
      return false;
    }

    InitShaders();

    console.info('gpu.js initialized');
  };

  me.Run = function(data, shaders) {
    updateShader = new GL.Shader(shaders[0], shaders[1]);

    // from http://concord-consortium.github.io/lab/experiments/webgl-gpgpu/script.js

    gl.canvas.width = 512;
    gl.canvas.height = 512;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.DEPTH_TEST);

    plane = GL.Mesh.plane({ coords: true });

    // Do not use only single component textures (ALPHA/LUMINANCE), as they cause problems on some GPUs
    // (when used as render targets).
    textureA = new GL.Texture(TEX_WIDTH, TEX_HEIGHT,
        { type: gl.FLOAT, format: gl.RGBA, filter: gl.NEAREST });
    textureB = new GL.Texture(TEX_WIDTH, TEX_HEIGHT,
        { type: gl.FLOAT, format: gl.RGBA, filter: gl.NEAREST });

    outputTexture = new GL.Texture(TEX_WIDTH, TEX_HEIGHT,
        { type: gl.UNSIGNED_BYTE, format: gl.RGBA, filter: gl.NEAREST });
    outputStorage = new Uint8Array(TEX_WIDTH * TEX_HEIGHT * 4);
    outputConverted = new Float32Array(TEX_WIDTH * TEX_HEIGHT);

    // !!! Workaround for the bug: http://code.google.com/p/chromium/issues/detail?id=125481 !!!
    // lightgl.js sets this parameter to 1 during each GL.Texture call, so overwrite it when
    // all textures are created.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    // Send data to gpu
    // TODO use data passed in
    var i, data, dataGPU;
    data = new Float32Array(TEX_WIDTH * TEX_HEIGHT);
    dataGPU = new Float32Array(TEX_WIDTH * TEX_HEIGHT * 4);
    for (i=0, len = TEX_WIDTH * TEX_HEIGHT; i < len; i++) {
      //data[i] = Math.random() * RANGE;
      dataGPU[4 * i] = data[i];
      dataGPU[4 * i + 1] = 0;
      dataGPU[4 * i + 2] = 0;
      dataGPU[4 * i + 3] = 0;
    }

    me.WriteTexture(textureA, dataGPU);

    $('#canvas_container').append(gl.canvas);
    gl.ondraw = onDrawCallback;
    gl.animate();

    return true;
  };

  me.WriteTexture = function(tex, input) {
    // Make sure that texture is bound.
    gl.bindTexture(gl.TEXTURE_2D, tex.id);
    gl.texImage2D(gl.TEXTURE_2D, 0, tex.format, tex.width, tex.height, 0, tex.format, tex.type, input);
    gl.finish();
  };

  me.MakeDataArray = fucntion() {
    return new Float32Array(TEX_WIDTH * TEX_HEIGHT);
  }

  me.GetConvertedOutput = function() {
    return outputConverted;
  }

  function onDrawCallback() {
    if (!textureB) return;

    // Step GPU
    textureB.drawTo(function () {
      textureA.bind();
      updateShader.uniforms({
        delta: [1 / TEX_WIDTH, 1 / TEX_HEIGHT]
      }).draw(plane);
    });
    textureB.swapWith(textureA);
    gl.finish();

    // Read
    readTextureMethod1(textureA);

    // Render
    render();
  }

  function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Set viewport as GPGPU operations can modify it.
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    textureA.bind(0);
    renderShader.uniforms({
      texture: 0,
      range: RANGE
    }).draw(plane);
    textureA.unbind(0);
    gl.finish();
  }

  /*
  function simulationStepCPU() {
    var i, j, iwidth, idx, avg, n, w, s, e, size = TEX_WIDTH * TEX_HEIGHT;
    for (i = 0; i < TEX_HEIGHT; i += 1) {
      iwidth = i * TEX_WIDTH;
      for (j = 0; j < TEX_WIDTH; j += 1) {
        idx = iwidth + j;
        // Clamp to edge.
        n = idx - TEX_WIDTH; if (n < 0) n = idx;
        w = idx - 1;         if (w < 0) w = idx;
        s = idx + TEX_WIDTH; if (s > size - 1) s = idx;
        e = idx + 1;         if (e > size - 1) e = idx;
        avg = (data[n] + data[w] + data[s] + data[e]) * 0.25;
        dataTmp[idx] = data[idx] + (avg - data[idx]) * 0.5;
      }
    }
    data = dataTmp;
  }
  */

  function InitShaders() {
    renderShader = new GL.Shader('\
      varying vec2 coord;\
      void main() {\
        coord = gl_TexCoord.xy;\
        gl_Position = gl_Vertex;\
      }\
      ', '\
        uniform sampler2D texture;\
        uniform float range;\
        varying vec2 coord;\
        void main() {\
          gl_FragColor = vec4(texture2D(texture, coord).r / range, 0.0, 1.0 - texture2D(texture, coord).r / range, 1.0);\
        }\
      ');

     // ========================================================================
     // The first method of encoding floats based on:
     // https://github.com/cscheid/facet/blob/master/src/shade/bits/encode_float.js
     //
     // After rendering to RGBA, UNSIGNED_BYTE texture just call gl.readPixels with
     // an Uint8Array array and cast it to Float32Array.
     // e.g.:
     // var output = new Uint8Array(size);
     // (render to RGBA texture)
     // gl.readPixels(..., output);
     // var result = new Float32Array(output.buffer);
     //
     // 'result' array should be filled with float values.
     //
     encodeShader1 = new GL.Shader('\
       varying vec2 coord;\
       void main() {\
         coord = gl_Vertex.xy * 0.5 + 0.5;\
         gl_Position = vec4(gl_Vertex.xyz, 1.0);\
       }\
       ', '\
         uniform sampler2D texture;\
         varying vec2 coord;\
         float shift_right(float v, float amt) {\
           v = floor(v) + 0.5;\
           return floor(v / exp2(amt));\
         }\
         float shift_left(float v, float amt) {\
           return floor(v * exp2(amt) + 0.5);\
         }\
         \
         float mask_last(float v, float bits) {\
           return mod(v, shift_left(1.0, bits));\
         }\
         float extract_bits(float num, float from, float to) {\
           from = floor(from + 0.5);\
           to = floor(to + 0.5);\
           return mask_last(shift_right(num, from), to - from);\
         }\
         vec4 encode_float(float val) {\
           if (val == 0.0)\
             return vec4(0, 0, 0, 0);\
           float sign = val > 0.0 ? 0.0 : 1.0;\
           val = abs(val);\
           float exponent = floor(log2(val));\
           float biased_exponent = exponent + 127.0;\
           float fraction = ((val / exp2(exponent)) - 1.0) * 8388608.0;\
           \
           float t = biased_exponent / 2.0;\
           float last_bit_of_biased_exponent = fract(t) * 2.0;\
           float remaining_bits_of_biased_exponent = floor(t);\
           \
           float byte4 = extract_bits(fraction, 0.0, 8.0) / 255.0;\
           float byte3 = extract_bits(fraction, 8.0, 16.0) / 255.0;\
           float byte2 = (last_bit_of_biased_exponent * 128.0 + extract_bits(fraction, 16.0, 23.0)) / 255.0;\
           float byte1 = (sign * 128.0 + remaining_bits_of_biased_exponent) / 255.0;\
           return vec4(byte4, byte3, byte2, byte1);\
         }\
         void main() {\
           vec4 data = texture2D(texture, coord);\
           gl_FragColor = encode_float(data.r);\
         }\
       ');
  }

  function readTextureMethod1(tex) {
    outputTexture.drawTo(function () {
      tex.bind();
      encodeShader1.draw(plane);
      // format: gl.RGBA, type: gl.UNSIGNED_BYTE - only this set is accepted by WebGL readPixels.
      gl.readPixels(0, 0, outputTexture.width, outputTexture.height,
        outputTexture.format, outputTexture.type, outputStorage);
      outputConverted = new Float32Array(outputStorage.buffer);
    });
    gl.finish();
  }
};
