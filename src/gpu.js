
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

    var data = new Float32Array(TEX_WIDTH * TEX_HEIGHT);

    return true;
  };

};
