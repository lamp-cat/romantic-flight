import { featGLSL } from './layout.js';
// 程序化地面着色：根据世界坐标 (x, z) 计算每个生物群系的颜色。
export const groundGLSL = /* glsl */ `
uniform float uBiome;
uniform float uTime;
varying vec3 vWPos;
${featGLSL}

float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1.,0.)),u.x), mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5;} return s; }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
// 手绘笔触：方向随位置缓慢变化的短笔画
float strokes(vec2 p, float len, float wid){
  float a = vn(p*.006)*5. + vn(p*.03)*1.2;
  vec2 d = vec2(cos(a), sin(a));
  vec2 q = vec2(dot(p,d), dot(p,vec2(-d.y,d.x)));
  return vn(q*vec2(1./len, 1./wid));
}
float paint(vec2 p){ return strokes(p, 7., 1.1)*.5 + strokes(p+31., 16., 2.5)*.3 + vn(p*.05)*.2; }
float band(float x, float hw, float aa){ return 1.-smoothstep(hw-aa, hw+aa, abs(x)); }
float wob(float z, float s){ return (vn(vec2(3.7, z*.045+s))-.5)*2. + (vn(vec2(9.1, z*.21+s))-.5)*.8; }

vec3 river(vec2 p, float cx, float hw, vec3 deep, vec3 shallow, vec3 bank, vec3 rim, vec3 base, float seed){
  float x = p.x - cx;
  float wl = -hw + wob(p.y, seed)*1.8, wr = hw + wob(p.y, seed+7.)*1.8;
  float c = .5*(wl+wr), w = .5*(wr-wl);
  float dx = abs(x - c);
  vec3 col = base;
  float rn = (vn(p*.2)-.5)*1.4;
  col = mix(col, rim, 1.-smoothstep(w+5.+rn, w+6.5+rn, dx));
  col = mix(col, bank, 1.-smoothstep(w+2.2+rn*.5, w+3.4+rn*.5, dx));
  float t = clamp(dx / w, 0., 1.);
  vec3 water = mix(deep, shallow, smoothstep(.2, 1., t + (vn(p*.04)-.5)*.3));
  float fl = vn(vec2(x*.22, (p.y + uTime*6.)*.045)) * .6 + vn(vec2(x*.8, (p.y + uTime*9.)*.12))*.4;
  water *= .9 + .2*fl;
  water += vec3(.05,.06,.07) * smoothstep(.7, .9, vn(vec2(x*.5, p.y*.03 - uTime*.2)));
  col = mix(col, water, 1.-smoothstep(w-.6, w+.6, dx));
  return col;
}

// 不规则一维分割：返回 (序号, 起点, 终点)
vec3 part(float x, float W, float J, float seed){
  float i = floor(x/W);
  float b0 = i*W + (h12(vec2(i,seed))-.5)*J;
  if (x < b0) i -= 1.;
  else { float b1 = (i+1.)*W + (h12(vec2(i+1.,seed))-.5)*J; if (x >= b1) i += 1.; }
  return vec3(i, i*W + (h12(vec2(i,seed))-.5)*J, (i+1.)*W + (h12(vec2(i+1.,seed))-.5)*J);
}

vec3 niigata(vec2 p){
  vec3 bx = part(p.x, 100., 40., 1.), bz = part(p.y, 74., 22., 2.);
  vec2 bi = vec2(bx.x, bz.x);
  float w = bx.z - bx.y, hgt = bz.z - bz.y;
  float lx = p.x - bx.y - 2.2, lz = p.y - bz.y - 1.6;
  float ncol = 5. + floor(h12(bi*1.7+3.)*4.);
  float cw = (w - 4.4)/ncol;
  float ci = floor(lx/cw);
  vec2 id = bi*13. + vec2(ci, 0.);
  float r = h12(id*1.37 + 4.1);
  vec3 c0=vec3(.45,.70,.92), c1=vec3(.62,.83,.96), c2=vec3(.42,.75,.72), c3=vec3(.50,.81,.60), c4=vec3(.60,.48,.36);
  vec3 pc = r<.30? c0 : r<.55? c1 : r<.76? c2 : r<.975? c3 : c4;
  pc = mix(pc, mix(c1, c3, h12(id+2.)), .3*h12(id+9.));
  float u = fract(lx/cw), v = clamp(lz/(hgt-3.2), 0., 1.);
  // 每块田里的天光渐变 + 水面笔触
  pc *= .94 + .1*(1.-v) + .05*(u-.5);
  pc *= .93 + .14*paint(p*.9);
  pc += vec3(.05,.06,.07) * smoothstep(.55, .85, vn(p*.012 + vec2(uTime*.03, 0.)));
  vec3 col = s2l(pc);
  // 柔和田埂
  float fxx = fract(lx/cw)*cw; float ex = min(fxx, cw-fxx) + (vn(p*vec2(.3,.05))-.5)*.5;
  col = mix(col, s2l(vec3(.64,.88,.44)), (1.-smoothstep(.3, 1.25, ex))*.85);
  // 小木桩
  vec2 q = vec2(ex, min(lz, hgt-3.2-lz));
  if (h12(id+vec2(7.,bi.y)) < .5) {
    float d = length(vec2(fxx<cw*.5?fxx:fxx-cw, lz - (hgt-3.2)*.5));
    col = mix(col, s2l(vec3(.32,.30,.24)), (1.-smoothstep(1.1,1.7,length(vec2(fxx<cw*.5?fxx:fxx-cw, lz-(hgt-3.2)*.5)-vec2(.7,.7))))*.5);
    col = mix(col, s2l(vec3(.88,.84,.64)), 1.-smoothstep(1.,1.4,d));
  }
  // 农道
  float vr = min(p.x-bx.y, bx.z-p.x), hr = min(p.y-bz.y, bz.z-p.y);
  vec3 tan = vec3(.87,.77,.63) * (.94+.1*vn(p*.8));
  col = mix(col, s2l(vec3(.60,.86,.38)), (1.-smoothstep(2.4, 3.3, vr))*.9);
  col = mix(col, s2l(tan), 1.-smoothstep(1.4, 2.0, vr + (vn(p*.4)-.5)*.5));
  col = mix(col, s2l(vec3(.42,.62,.56)), (1.-smoothstep(1.8, 2.8, hr))*.3);
  col = mix(col, s2l(tan), (1.-smoothstep(1.0, 1.6, hr + (vn(p*.4)-.5)*.5))*.9);
  // 主路
  float rx = p.x - nRoad(p.y);
  col = mix(col, s2l(vec3(.56,.82,.38)), band(rx, 8.5, .8));
  col = mix(col, s2l(vec3(.83,.78,.70)*(.95+.08*vn(p*.6))), band(rx, 7., .5));
  col = mix(col, s2l(vec3(.68,.63,.57)), band(abs(rx)-6.6, .35, .3));
  col = mix(col, s2l(vec3(.95,.93,.88)), band(abs(rx)-2.2, .3, .25));
  // 河流 + 桥
  float rc = nRiver(p.y);
  col = river(p, rc, 31., s2l(vec3(.22,.42,.70)), s2l(vec3(.33,.58,.84)), s2l(vec3(.88,.79,.60)), s2l(vec3(.58,.86,.36)), col, 1.);
  float bzz = p.y - bz.y;
  if (h12(vec2(bz.x, 3.)) < .14 && abs(p.x-rc) < 40.) {
    float bb = band(bzz, 3.6, .3);
    col = mix(col, s2l(vec3(.62,.30,.22)), bb);
    col = mix(col, s2l(vec3(.80,.40,.28)), band(bzz, 2.4, .3));
    col = mix(col, s2l(vec3(.40,.20,.16)), band(abs(bzz)-3.2, .35, .2)*bb);
  }
  return col;
}

vec3 pampa(vec2 p){
  float n = fbm(p*.003), n2 = fbm(p*.0065 + 5.), n3 = fbm(p*.012+11.);
  vec3 c = mix(vec3(.52,.74,.21), vec3(.69,.84,.28), smoothstep(.32,.68,n));
  c = mix(c, vec3(.43,.65,.24), smoothstep(.56,.64,n2)*.6);
  c = mix(c, vec3(.74,.85,.32), smoothstep(.62,.72,n3)*.3);
  c *= .93 + .12*paint(p);
  vec3 col = s2l(c);
  float rx = p.x - pRoad(p.y) + wob(p.y, 3.)*.4;
  col = mix(col, s2l(vec3(.62,.54,.32)), band(rx, 4.8, .6)*.45);
  col = mix(col, s2l(vec3(.80,.62,.46)*(.93+.1*vn(p*vec2(1.5,.3)))), band(rx, 3.6, .4));
  col = mix(col, s2l(vec3(.64,.47,.34)), band(abs(rx)-2.8, .45, .3));
  col = mix(col, s2l(vec3(.68,.50,.36)), band(rx, .5, .3)*.5);
  col = river(p, pRiver(p.y), 28., s2l(vec3(.22,.46,.72)), s2l(vec3(.34,.60,.82)), s2l(vec3(.90,.80,.60)), s2l(vec3(.55,.70,.28)), col, 2.);
  return col;
}

vec3 serengeti(vec2 p){
  float n = fbm(p*.005), n2 = fbm(p*.0085 + 21.), n3 = fbm(p*.04);
  vec3 c = mix(vec3(.93,.70,.25), vec3(.99,.80,.37), smoothstep(.3,.7,n));
  c = mix(c, vec3(.68,.62,.30), smoothstep(.54,.62,n2 + (n3-.5)*.12)*.8);
  c = mix(c, vec3(.82,.58,.20), smoothstep(.6,.75,n3)*.25);
  // 长草：短弧笔触
  float g = strokes(p, 5., .7)*.55 + strokes(p+17., 11., 1.4)*.45;
  c *= .88 + .22*g;
  vec3 col = s2l(c);
  float rx = p.x - sTrack(p.y) + wob(p.y, 5.)*1.;
  col = mix(col, s2l(vec3(.82,.55,.28)), band(rx, 3.8, .7)*.35);
  col = mix(col, s2l(vec3(.72,.36,.20)), band(abs(rx)-2.6, .8, .35));
  col = river(p, sRiver(p.y), 23., s2l(vec3(.22,.48,.48)), s2l(vec3(.34,.62,.58)), s2l(vec3(.94,.92,.80)), s2l(vec3(.60,.62,.32)), col, 4.);
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
  fc *= .92 + .13*paint(p*1.1);
  fc = mix(fc, fc*vec3(.88,.92,.8), (1.-smoothstep(13., 26., edge))*.4);
  vec3 gc = mix(vec3(.18,.52,.18), vec3(.30,.64,.24), paint(p*1.4));
  vec3 col = s2l(mix(gc, fc, smoothstep(13., 14.5, edge)));
  float rc = jRoad(p.y), rx = p.x - rc;
  col = mix(col, s2l(vec3(.70,.70,.62)), band(rx, 6.6, .5));
  col = mix(col, s2l(vec3(.84,.81,.75)*(.95+.08*vn(p*.5))), band(rx, 5.6, .4));
  float zi = floor(p.y/420.); float zc = zi*420. + 80. + h12(vec2(zi,1.))*260.;
  if (h12(vec2(zi,7.)) < .7 && p.x < rc) {
    float sz = p.y - zc - (p.x-rc)*.08 + sin(p.x*.012)*6.;
    col = mix(col, s2l(vec3(.70,.70,.64)), band(sz, 4.6, .5));
    col = mix(col, s2l(vec3(.82,.80,.76)), band(sz, 3.8, .4));
  }
  col = river(p, jRiver(p.y), 17., s2l(vec3(.15,.36,.78)), s2l(vec3(.22,.48,.86)), s2l(vec3(.86,.82,.68)), s2l(vec3(.25,.58,.22)), col, 6.);
  return col;
}

vec3 groundColor(vec2 p){
  if (uBiome < .5) return niigata(p);
  if (uBiome < 1.5) return pampa(p);
  if (uBiome < 2.5) return serengeti(p);
  return punjab(p);
}
`;

// 后期：世界坐标锚定的手绘抖动 + 轻度油画滤镜 + 纸纹/颗粒 + 水彩喷溅撕纸边缘
export const postFrag = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform vec4 uRect;
uniform vec4 uArt;
uniform vec2 uCam;
uniform float uTime;
uniform float uReveal;
uniform float uSeed;
uniform float uPaint;
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
  vec2 dp = uRect.xy + vec2(vUv.x, 1.-vUv.y) * uRect.zw;
  // 手绘抖动：以世界坐标为锚，线条边缘轻微起伏但不会“沸腾”
  vec2 wp = dp - uArt.xy + uCam;
  float ppu = uRes.x / uRect.z;
  vec2 off = (vec2(vn(wp*.28), vn(wp*.28 + 5.3)) - .5) * 1.3 + (vec2(vn(wp*.9+2.), vn(wp*.9+7.)) - .5) * .5;
  vec2 uv = vUv + off * ppu / uRes * vec2(1., -1.);
  vec3 lin = uPaint > .5 ? kuwahara(uv) : texture2D(tDiffuse, uv).rgb;
  vec3 col = pow(max(lin, 0.), vec3(1./2.2));
  float paper = fbm(dp*.55);
  col *= .975 + .05*paper;
  col += (h12(gl_FragCoord.xy + floor(uTime*24.)*vec2(17.3, 41.1)) - .5) * .04;
  col = mix(vec3(dot(col, vec3(.299,.587,.114))), col, 1.04);

  // 水彩喷溅边缘：圆角矩形 SDF + 低频起伏 + 成簇的白色飞沫
  vec2 q = abs(dp - uArt.xy) - uArt.zw + 16.;
  float d = length(max(q,0.)) + min(max(q.x,q.y),0.) - 16.;
  d += (fbm(dp*.009 + uSeed) - .5) * 30.;
  d += (fbm(dp*.05 + uSeed*3.) - .5) * 8.;
  d += (1. - uReveal) * 300. * (.75 + .5*fbm(dp*.008 + 7.));
  float t = clamp((d + 16.) / 22., 0., 1.);
  float spray = h12(floor(dp*1.6) + uSeed) * .55 + vn(dp*.55 + uSeed) * .45;
  float keep = smoothstep(pow(t, .8) - .04, pow(t, .8) + .04, spray * .98);
  col = mix(col, vec3(1.), pow(smoothstep(-50., 4., d), 1.6) * .5);
  col = mix(vec3(1.), col, keep * (1. - smoothstep(4., 7., d)));
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}
`;
