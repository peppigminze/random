'use strict';
// LUMEN — WebGL post-processing: two-level bloom, chromatic aberration, lens warp, vignette, grain
(function () {
  const L = window.L;
  const P = L.post = { ok: false, ca: 0, flash: 0, flashCol: [1, 1, 1], glitch: 0 };
  let gl, quad, progs = {}, tex, fbos = [], W = 0, H = 0;

  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS_BRIGHT = `precision mediump float;varying vec2 uv;uniform sampler2D t;
    void main(){vec3 c=texture2D(t,uv).rgb;float l=max(c.r,max(c.g,c.b));
    gl_FragColor=vec4(c*smoothstep(.32,.8,l),1.);}`;
  const FS_BLUR = `precision mediump float;varying vec2 uv;uniform sampler2D t;uniform vec2 d;
    void main(){vec3 c=texture2D(t,uv).rgb*.2270;
    c+=(texture2D(t,uv+d*1.385).rgb+texture2D(t,uv-d*1.385).rgb)*.3162;
    c+=(texture2D(t,uv+d*3.231).rgb+texture2D(t,uv-d*3.231).rgb)*.0703;
    gl_FragColor=vec4(c,1.);}`;
  const FS_FINAL = `precision mediump float;varying vec2 uv;
    uniform sampler2D scene,b1,b2;uniform float ca,bloom,time,flash,invert,glitch,grain;uniform vec3 flashCol;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec2 c=uv-.5;float r2=dot(c,c);
      vec2 u=uv+c*r2*.045;
      if(glitch>0.){float row=floor(u.y*38.);float n=hash(vec2(row,floor(time*24.)));
        if(n>1.-glitch*.5)u.x+=(hash(vec2(row,time))-.5)*.14*glitch;}
      vec2 off=c*(ca*(.5+r2*3.5)+.0012);
      vec3 col=vec3(texture2D(scene,u+off).r,texture2D(scene,u).g,texture2D(scene,u-off).b);
      vec3 bl=texture2D(b1,u).rgb*.75+texture2D(b2,u).rgb;
      col+=bl*bloom;
      col=mix(col,1.-exp(-col*1.5),.55);
      float v=smoothstep(.95,.3,length(c*vec2(1.,.9)));
      col*=mix(.35,1.,v);
      col+=(hash(gl_FragCoord.xy+time*61.)-.5)*grain;
      col=mix(col,flashCol,flash);
      if(invert>.5){float mx=max(col.r,max(col.g,col.b)),mn=min(col.r,min(col.g,col.b));col+=1.-(mx+mn);col=mix(col,vec3(.96,.93,.86),.08);}
      gl_FragColor=vec4(col,1.);}`;

  function compile(fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  function mkTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }
  function mkFbo(w, h) {
    const t = mkTex(w, h), f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { f, t, w, h };
  }

  P.init = function (canvas) {
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      progs.bright = compile(FS_BRIGHT); progs.blur = compile(FS_BLUR); progs.final = compile(FS_FINAL);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      tex = mkTex(0, 0);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); P.ok = false; });
      P.ok = true;
    } catch (e) { console.warn('post-processing disabled:', e.message); P.ok = false; }
    return P.ok;
  };

  function resize(w, h) {
    W = w; H = h;
    for (const f of fbos) { gl.deleteFramebuffer(f.f); gl.deleteTexture(f.t); }
    const q = (d) => [Math.max(2, w >> d), Math.max(2, h >> d)];
    fbos = [mkFbo(...q(1)), mkFbo(...q(2)), mkFbo(...q(2)), mkFbo(...q(3)), mkFbo(...q(3))];
  }
  function pass(prog, src, dst) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : H);
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  P.render = function (src, time) {
    if (!P.ok) return;
    const w = src.width, h = src.height, s = L.set();
    if (w !== W || h !== H) resize(w, h);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const bloomOn = s.post;
    if (bloomOn) {
      const [half, qa, qb, ea, eb] = fbos;
      gl.useProgram(progs.bright.p); gl.uniform1i(progs.bright.u.t, 0);
      pass(progs.bright, tex, half);
      gl.useProgram(progs.blur.p); gl.uniform1i(progs.blur.u.t, 0);
      gl.uniform2f(progs.blur.u.d, 1 / qa.w, 0); pass(progs.blur, half.t, qa);
      gl.uniform2f(progs.blur.u.d, 0, 1 / qa.h); pass(progs.blur, qa.t, qb);
      gl.uniform2f(progs.blur.u.d, 1 / ea.w, 0); pass(progs.blur, qb.t, ea);
      gl.uniform2f(progs.blur.u.d, 0, 1 / ea.h); pass(progs.blur, ea.t, eb);
    }
    const f = progs.final;
    gl.useProgram(f.p);
    gl.uniform1i(f.u.scene, 0); gl.uniform1i(f.u.b1, 1); gl.uniform1i(f.u.b2, 2);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbos[2].t);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fbos[4].t);
    const calm = !s.flash; // "reduce flashing" accessibility option
    gl.uniform1f(f.u.ca, bloomOn ? Math.min(calm ? 0.004 : 0.03, P.ca) : 0);
    gl.uniform1f(f.u.bloom, bloomOn ? 1.0 : 0);
    gl.uniform1f(f.u.time, time % 100);
    gl.uniform1f(f.u.flash, calm ? Math.min(0.12, P.flash) : Math.min(0.85, P.flash));
    gl.uniform3f(f.u.flashCol, P.flashCol[0], P.flashCol[1], P.flashCol[2]);
    gl.uniform1f(f.u.invert, L.save.data.secret.solarOn ? 1 : 0);
    gl.uniform1f(f.u.glitch, calm ? 0 : P.glitch);
    gl.uniform1f(f.u.grain, bloomOn ? 0.05 : 0);
    pass(f, tex, null);
  };
})();
