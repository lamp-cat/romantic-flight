// 程序化地面着色：根据世界坐标 (x, z) 计算每个生物群系的颜色。
// 所有地物（稻田、河流、道路、田块）都在着色器里画，所以区块之间天然无缝。
export const groundGLSL = /* glsl */ `
uniform float uBiome;
uniform float uTime;
varying vec3 vWPos;

float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x), mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5;} return s; }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
// 画笔笔触：沿 z 方向拉长的噪声
float brush(vec2 p){ return vn(vec2(p.x*.45, p.y*.07))*.55 + vn(vec2(p.x*1.4, p.y*.22))*.30 + vn(p*2.5)*.15; }
float band(float x, float hw, float aa){ return 1.-smoothstep(hw-aa, hw+aa, abs(x)); }
float wob(float z, float s){ return (vn(vec2(3.7, z*.045+s))-.5)*2. + (vn(vec2(9.1, z*.21+s))-.5)*.8; }

// 河流：返回颜色并通过 m 返回覆盖度
vec3 river(vec2 p, float cx, float hw, vec3 deep, vec3 shallow, vec3 bank, vec3 rim, vec3 base, float seed){
  float x = p.x - cx;
  float wl = -hw + wob(p.y, seed)*1.6, wr = hw + wob(p.y, seed+7.)*1.6;
  float c = .5*(wl+wr), w = .5*(wr-wl);
  float dx = abs(x - c);
  vec3 col = base;
  col = mix(col, rim, 1.-smoothstep(w+5.5, w+6.5, dx));
  col = mix(col, bank, 1.-smoothstep(w+2.6, w+3.4, dx));
  float t = clamp(dx / w, 0., 1.);
  vec3 water = mix(deep, shallow, smoothstep(.25, 1., t));
  // 水面流动的笔触与高光
  float fl = vn(vec2(x*.25, (p.y + uTime*6.)*.05)) * .6 + vn(vec2(x*.9, (p.y + uTime*9.)*.12))*.4;
  water *= .88 + .24*fl;
  water += vec3(.06,.07,.08) * smoothstep(.72, .9, vn(vec2(x*.6, p.y*.03 - uTime*.2)));
  col = mix(col, water, 1.-smoothstep(w-.4, w+.4, dx));
  return col;
}

vec3 niigata(vec2 p){
  vec3 col;
  vec2 blk = vec2(100., 72.);
  vec2 bi = floor(p/blk); vec2 bf = p - bi*blk;
  float lx = bf.x - 3.5, lz = bf.y - 2.;
  float cw = 96.5/7., rh = 70.;
  vec2 cell = vec2(floor(lx/cw), floor(lz/rh));
  vec2 id = bi*13. + cell;
  float r = h12(id*1.37 + 4.1);
  vec3 c0=vec3(.42,.68,.92), c1=vec3(.60,.82,.96), c2=vec3(.40,.74,.70), c3=vec3(.47,.80,.58), c4=vec3(.58,.45,.33);
  vec3 pc = r<.30? c0 : r<.55? c1 : r<.76? c2 : r<.975? c3 : c4;
  pc = mix(pc, c1, .25*h12(id+9.));
  // 水面笔触与天空反射
  float cz = fract(lz/rh);
  pc *= .93 + .1*vn(p*vec2(.09,.025)) + .06*vn(p*vec2(.6,.08));
  pc *= .96 + .09*(1.-cz);
  pc += vec3(.05,.06,.07) * smoothstep(.55, .85, vn(p*.012 + vec2(uTime*.03, 0.)));
  col = s2l(pc);
  // 田埂
  float fx = mod(lx, cw), fz = mod(lz, rh);
  float ex = min(fx, cw-fx), ez = min(fz, rh-fz);
  col = mix(col, s2l(vec3(.56,.86,.32)), 1.-smoothstep(.55, 1.05, ex));
  col = mix(col, s2l(vec3(.28,.50,.50)), (1.-smoothstep(.35, .8, ez))*.55);
  // 小木桩
  vec2 q = vec2(fx<cw*.5?fx:fx-cw, fz<rh*.5?fz:fz-rh);
  vec2 pid = floor((vec2(lx,lz)+vec2(cw,rh)*.5)/vec2(cw,rh)) + bi*13.;
  if (h12(pid*2.3+1.) < .28) {
    float d = length(q - vec2(.3,.3));
    col = mix(col, s2l(vec3(.30,.28,.22)), (1.-smoothstep(1.2,1.7,length(q-vec2(.7,.7))))*.6);
    col = mix(col, s2l(mix(vec3(.88,.84,.62), vec3(.62,.55,.38), smoothstep(-.6,.9,q.x+q.y))), 1.-smoothstep(1.1,1.5,d));
  }
  // 农道
  float vr = min(bf.x, blk.x-bf.x), hr = min(bf.y, blk.y-bf.y);
  vec3 tan = vec3(.86,.74,.60) * (.94+.1*vn(p*.8));
  col = mix(col, s2l(vec3(.55,.84,.3)), 1.-smoothstep(2.7, 3.4, vr));
  col = mix(col, s2l(tan), 1.-smoothstep(1.8, 2.4, vr));
  col = mix(col, s2l(vec3(.30,.52,.50)), (1.-smoothstep(2.4, 3.2, hr))*.35);
  col = mix(col, s2l(tan), (1.-smoothstep(1.3, 1.9, hr))*.9);
  // 主路
  float rx = p.x + 130.;
  col = mix(col, s2l(vec3(.5,.8,.32)), band(rx, 8.5, .5));
  col = mix(col, s2l(vec3(.82,.76,.68)*(.95+.08*vn(p*.6))), band(rx, 7., .4));
  col = mix(col, s2l(vec3(.66,.6,.54)), band(abs(rx)-6.6, .35, .25));
  col = mix(col, s2l(vec3(.95,.93,.88)), band(abs(rx)-2.2, .3, .2));
  // 河流
  col = river(p, 80., 31., s2l(vec3(.20,.39,.68)), s2l(vec3(.30,.55,.82)), s2l(vec3(.88,.78,.58)), s2l(vec3(.55,.85,.30)), col, 1.);
  // 桥
  float bz = p.y - (bi.y)*blk.y;
  if (h12(vec2(bi.y, 3.)) < .14 && abs(p.x-80.) < 40.) {
    float bb = band(bz, 3.6, .3);
    col = mix(col, s2l(vec3(.62,.30,.22)), bb);
    col = mix(col, s2l(vec3(.80,.40,.28)), band(bz, 2.4, .3));
    col = mix(col, s2l(vec3(.40,.20,.16)), band(abs(bz)-3.2, .35, .2)*bb);
  }
  return col;
}

vec3 pampa(vec2 p){
  float n = fbm(p*.003), n2 = fbm(p*.0065 + 5.), n3 = fbm(p*.012+11.);
  vec3 c = mix(vec3(.52,.74,.20), vec3(.68,.84,.27), smoothstep(.32,.68,n));
  c = mix(c, vec3(.44,.66,.24), smoothstep(.56,.64,n2)*.55);
  c = mix(c, vec3(.74,.85,.32), smoothstep(.62,.72,n3)*.35);
  c *= .95 + .08*brush(p*.6);
  vec3 col = s2l(c);
  float rx = p.x + 135. + wob(p.y, 3.)*.5;
  col = mix(col, s2l(vec3(.62,.52,.30)), band(rx, 4.6, .5)*.5);
  col = mix(col, s2l(vec3(.80,.62,.46)*(.93+.1*vn(p*vec2(1.5,.3)))), band(rx, 3.6, .35));
  col = mix(col, s2l(vec3(.64,.47,.34)), band(abs(rx)-2.8, .45, .25));
  col = mix(col, s2l(vec3(.66,.46,.33)), band(rx, .5, .3)*.6);
  col = river(p, 90., 28., s2l(vec3(.22,.46,.72)), s2l(vec3(.34,.60,.82)), s2l(vec3(.90,.80,.60)), s2l(vec3(.55,.70,.28)), col, 2.);
  return col;
}

vec3 serengeti(vec2 p){
  float n = fbm(p*.005), n2 = fbm(p*.0085 + 21.), n3 = fbm(p*.04);
  vec3 c = mix(vec3(.93,.70,.24), vec3(.99,.80,.36), smoothstep(.3,.7,n));
  c = mix(c, vec3(.76,.64,.30), smoothstep(.55,.66,n2)*.6);
  c = mix(c, vec3(.80,.56,.18), smoothstep(.6,.75,n3)*.3);
  // 长草笔触
  float g = vn(vec2(p.x*1.1, p.y*.18)) * .6 + vn(vec2(p.x*3., p.y*.5))*.4;
  c *= .9 + .18*g;
  vec3 col = s2l(c);
  float rx = p.x + 165. + wob(p.y, 5.)*1.2;
  col = mix(col, s2l(vec3(.80,.52,.26)), band(rx, 3.6, .6)*.35);
  col = mix(col, s2l(vec3(.72,.36,.20)), band(abs(rx)-2.6, .8, .3));
  col = river(p, -15., 33., s2l(vec3(.22,.48,.48)), s2l(vec3(.34,.62,.58)), s2l(vec3(.94,.92,.80)), s2l(vec3(.60,.62,.32)), col, 4.);
  return col;
}

vec3 vor(vec2 x){
  vec2 n = floor(x), f = fract(x), mg, mr; float md = 8.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i),float(j)); vec2 o = .15 + .7*h22(n+g); vec2 r = g + o - f; float d = dot(r,r);
    if(d<md){ md=d; mr=r; mg=g; }
  }
  md = 8.;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){
    vec2 g = mg + vec2(float(i),float(j)); vec2 o = .15 + .7*h22(n+g); vec2 r = g + o - f;
    if(dot(mr-r,mr-r)>1e-5){ float e = dot(.5*(mr+r), normalize(r-mr)); float k=.09; float h = clamp(.5+.5*(e-md)/k, 0., 1.); md = mix(e, md, h) - k*h*(1.-h); }
  }
  return vec3(md, h12(n+mg), h12(n+mg+3.3));
}

vec3 punjab(vec2 p){
  float S = 230.;
  vec2 w = vec2(fbm(p*.007), fbm(p*.007+9.)) - .5;
  vec3 v = vor(p/S + w*.6);
  float edge = v.x*S + (vn(p*.012)-.5)*14. + (vn(p*.08)-.5)*2.5 + (vn(p*.6)-.5)*1.2;
  vec3 fc;
  float tone = fbm(p*.02 + v.y*40.);
  if (v.y < .80) {
    fc = mix(vec3(.99,.86,.16), vec3(1.,.91,.32), v.z);
    fc = mix(fc, vec3(.92,.76,.10), smoothstep(.5,.7,tone)*.6);
  } else {
    fc = mix(vec3(.62,.80,.24), vec3(.74,.86,.30), v.z);
  }
  fc *= .92 + .14*brush(p*1.2);
  fc = mix(fc, fc*vec3(.88,.92,.8), (1.-smoothstep(13., 26., edge))*.4);
  vec3 gc = mix(vec3(.18,.52,.18), vec3(.30,.64,.24), brush(p*1.5));
  vec3 col = s2l(mix(gc, fc, smoothstep(13., 14.5, edge)));
  // 主路
  float rx = p.x + 98.;
  col = mix(col, s2l(vec3(.70,.70,.62)), band(rx, 6.6, .4));
  col = mix(col, s2l(vec3(.84,.81,.75)*(.95+.08*vn(p*.5))), band(rx, 5.6, .3));
  // 支路（向左分叉）
  float zi = floor(p.y/420.); float zc = zi*420. + 80. + h12(vec2(zi,1.))*260.;
  if (h12(vec2(zi,7.)) < .7 && p.x < -98.) {
    col = mix(col, s2l(vec3(.70,.70,.64)), band(p.y-zc, 4.6, .4));
    col = mix(col, s2l(vec3(.82,.80,.76)), band(p.y-zc, 3.8, .3));
  }
  col = river(p, 120., 17., s2l(vec3(.15,.36,.78)), s2l(vec3(.22,.48,.86)), s2l(vec3(.86,.82,.68)), s2l(vec3(.25,.58,.22)), col, 6.);
  return col;
}

vec3 groundColor(vec2 p){
  if (uBiome < .5) return niigata(p);
  if (uBiome < 1.5) return pampa(p);
  if (uBiome < 2.5) return serengeti(p);
  return punjab(p);
}
`;

// 后期：水彩撕纸遮罩 + 轻度油画（Kuwahara）滤镜 + 胶片颗粒 + 纸纹
export const postFrag = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;       // 画布像素尺寸
uniform vec4 uRect;      // 画布在设计坐标中的 (x0, y0, w, h)
uniform vec4 uArt;       // 画面矩形 (cx, cy, hx, hy) 设计坐标
uniform float uTime;
uniform float uReveal;   // 0..1 场景过渡
uniform float uSeed;
uniform float uPaint;    // 油画滤镜半径（像素）
varying vec2 vUv;

float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x), mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.07+13.7; a*=.5;} return s; }

vec3 kuwahara(vec2 uv){
  vec2 px = 1./uRes;
  vec3 m[4]; vec3 s[4];
  for(int k=0;k<4;k++){ m[k]=vec3(0.); s[k]=vec3(0.); }
  float R = uPaint;
  for(int j=0;j<=2;j++) for(int i=0;i<=2;i++){
    vec2 o = vec2(float(i),float(j)) * R / 2.;
    vec3 a = texture2D(tDiffuse, uv + vec2(-o.x,-o.y)*px).rgb; m[0]+=a; s[0]+=a*a;
    vec3 b = texture2D(tDiffuse, uv + vec2( o.x,-o.y)*px).rgb; m[1]+=b; s[1]+=b*b;
    vec3 c = texture2D(tDiffuse, uv + vec2(-o.x, o.y)*px).rgb; m[2]+=c; s[2]+=c*c;
    vec3 d = texture2D(tDiffuse, uv + vec2( o.x, o.y)*px).rgb; m[3]+=d; s[3]+=d*d;
  }
  vec3 best = m[0]/9.; float bv = 1e9;
  for(int k=0;k<4;k++){
    vec3 mu = m[k]/9.; vec3 var = abs(s[k]/9. - mu*mu);
    float v = var.r+var.g+var.b;
    if(v<bv){ bv=v; best=mu; }
  }
  return best;
}

void main(){
  vec2 dp = uRect.xy + vec2(vUv.x, 1.-vUv.y) * uRect.zw;   // 设计坐标（y 向下）
  vec3 lin = uPaint > .5 ? kuwahara(vUv) : texture2D(tDiffuse, vUv).rgb;
  vec3 col = pow(max(lin, 0.), vec3(1./2.2));
  // 纸纹 + 颗粒
  float paper = fbm(dp*.55) ;
  col *= .975 + .05*paper;
  col += (h12(gl_FragCoord.xy + floor(uTime*24.)*vec2(17.3, 41.1)) - .5) * .045;
  col = mix(vec3(dot(col, vec3(.299,.587,.114))), col, 1.04);

  // 撕纸/水彩边缘：圆角矩形 SDF + 多尺度噪声 + 飞白斑点
  vec2 q = abs(dp - uArt.xy) - uArt.zw + 12.;
  float d = length(max(q,0.)) + min(max(q.x,q.y),0.) - 12.;
  d += (fbm(dp*.011 + uSeed) - .5) * 26.;
  d += (fbm(dp*.06 + uSeed*3.) - .5) * 9.;
  d += (1. - uReveal) * 300. * (.75 + .5*fbm(dp*.008 + 7.));
  float t = clamp((d + 9.) / 15., 0., 1.);
  float speck = h12(floor(gl_FragCoord.xy / max(1., uRes.x/1300.)) + uSeed);
  float speck2 = vn(dp*.9 + uSeed);
  float keep = step(pow(t, .75), mix(speck, speck2, .45) * .98);
  col = mix(col, vec3(1.), pow(smoothstep(-48., 4., d), 1.6) * .5);
  col = mix(vec3(1.), col, keep * (1. - smoothstep(3., 6., d)));
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}
`;
