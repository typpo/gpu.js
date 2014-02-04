gpu.js
======

An easier wrapper around WebCLGL.

Write your shader:

    <script type="shader" id="testshader">
    void main(float* A, float* B) {
      vec2 x = get_global_id();
      out_float = A[x] + B[x];
    }
    </script>
    
Then call it from Javascript:

    var w = new GpuWorker();
    w.setResultRange(0, 10);
    
    var fn = w.prepare('testshader');
    
    var res = fn([1.0, 2.0, 3.0, 4.0], [0.1, 0.2, 0.3, 0.4]);
    console.log(res);

More to come..
