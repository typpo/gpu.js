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

  me.Init = function() {
    if (typeof GL === 'undefined') {
      console.error('gpu.js depends on the LightGL library.');
      return false;;
    }
    if (!gl.getExtension('OES_texture_float')) {
      console.error('gpu.js requires the OES_texture_float extension');
      return false;
    }
  };
  me.Run = function(data) {
    // from http://concord-consortium.github.io/lab/experiments/webgl-gpgpu/script.js
    gl = GL.create({ alpha: true });

    gl.canvas.width = 512;
    gl.canvas.height = 512;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.disable(gl.DEPTH_TEST);

    var plane, textureA, textureB, outputTexture, outputStorage;
    plane = GL.Mesh.plane({ coords: true });

    // Do not use only single component textures (ALPHA/LUMINANCE), as they cause problems on some GPUs
    // (when used as render targets).
    textureA = new GL.Texture(TEX_WIDTH, TEX_HEIGHT,
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

    return true;
  };

  me.WriteTexture = function(tex, input) {
    // Make sure that texture is bound.
    gl.bindTexture(gl.TEXTURE_2D, tex.id);
    gl.texImage2D(gl.TEXTURE_2D, 0, tex.format, tex.width, tex.height, 0, tex.format, tex.type, input);
    gl.finish();
  };


};
