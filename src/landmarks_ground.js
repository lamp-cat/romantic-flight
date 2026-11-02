// 地标世界的地面着色（GLSL）：街道、广场铺装、护城河/海港水面、公园。依赖 groundCommonGLSL 与 landmarks_layout.SHARED。
import { ORIGIN } from './landmarks_layout.js';
import { CITIES } from './lm/cities.js';
const O = (b) => `${ORIGIN[b][0].toFixed(1)}, ${ORIGIN[b][1].toFixed(1)}`;
export const lmGroundGLSL = /* glsl */ `
varying float vSlope;
vec3 gEm = vec3(0.);
// 道路：d 为到中线的横向距离，hw 半宽，al 沿路坐标；lanes>0 画车道虚线
vec3 road(vec3 col, float d, float hw, float al, float lanes, vec3 asph){
  float a = abs(d);
  col = mix(col, s2l(vec3(.84,.83,.80)*(.95+.06*vn(vec2(d, al)*.7))), 1.-smoothstep(hw+2.4, hw+3., a));
  col = mix(col, s2l(vec3(.70,.69,.67)), band(a - hw - .2, .35, .2));
  col = mix(col, s2l(asph*(.95+.07*vn(vec2(d*.6, al*.15)))), 1.-smoothstep(hw-.3, hw+.3, a));
  if (lanes > .5) {
    float dash = step(.45, fract(al/9.));
    for (int i = 1; i < 4; i++) {
      float lp = float(i)*3.6;
      if (lp < hw - 1.5) col = mix(col, s2l(vec3(.95,.95,.93)), band(a - lp, .22, .15)*dash*.85);
    }
    col = mix(col, s2l(vec3(.98,.98,.95)), band(a - hw + 1., .2, .15)*.8);
    if (lanes > 1.5) col = mix(col, s2l(vec3(.98,.86,.35)), band(a - .5, .2, .15)*.9);
  }
  return col;
}
vec3 water(vec2 p, vec3 deep, vec3 shal, float depth){
  vec3 c = mix(shal, deep, smoothstep(0., 1., depth));
  float fl = vn(vec2(p.x*.06 + uTime*.15, p.y*.18)) * .6 + vn(vec2(p.x*.2 - uTime*.25, p.y*.5 + uTime*.1)) * .4;
  c *= .92 + .14*fl;
  c += vec3(.10,.11,.12) * smoothstep(.72, .92, vn(vec2(p.x*.09 + uTime*.3, p.y*.35)));
  return s2l(c);
}
vec3 grass(vec2 p, float dark){
  vec3 c = mix(vec3(.46,.66,.33), vec3(.56,.74,.38), smoothstep(.3,.7,fbm(p*.02)));
  c = mix(c, vec3(.30,.50,.27), dark);
  return s2l(c*(.92+.12*paint(p)));
}

// ------------------------------------------------ 东京：东京塔、芝公园、增上寺
vec3 tokyo(vec2 p){
  float x = p.x, z = lmLocal(p.y, ${O(0)});
  float k = tkKind(x, z);
  vec3 col = s2l(vec3(.76,.75,.73)*(.95+.06*paint(p)));
  if (k > 1.5 && k < 2.5) {
    col = grass(p, .25 + .4*smoothstep(.45,.6,fbm(p*.03+3.)));
    // 公园小径
    float pth = abs(sin(x*.021 + sin(z*.017)*1.6)*30. - (z - 120.)*.2);
    col = mix(col, s2l(vec3(.86,.80,.66)), band(mod(pth, 60.) - 30., 1.6, .5)*.8);
  }
  if (k > 3.5) {
    // 塔下广场（灰色地砖）/ 增上寺前庭（白砂）
    if (x < 60.) { col = s2l(vec3(.80,.79,.77)*(.95+.06*vn(p*.8)));
      col = mix(col, s2l(vec3(.70,.69,.68)), band(mod(x, 6.) - 3., .2, .15)*.3); }
    else { col = s2l(vec3(.90,.86,.76)*(.94+.08*vn(p*vec2(.3,1.2))));
      // 参道
      col = mix(col, s2l(vec3(.72,.70,.68)), band(z - 60., 4., .4)*step(140., x)); }
  }
  // 街区格网道路
  bool inZone = x > -63. && x < 220. && z > -43. && z < 300.;
  vec3 asph = vec3(.52,.53,.56);
  if (!inZone) {
    col = road(col, mod(x + 70. + 30., 60.) - 30., 3.6, z, 0., asph);
    col = road(col, mod(z + 50. + 27.5, 55.) - 27.5, 3.6, x, 0., asph);
  }
  col = road(col, z + 50., 6.5, x, 1., asph);
  col = road(col, z - 170., 6.5, x, 1., asph);
  col = road(col, x + 70., 6.5, z, 1., asph);
  col = road(col, x - 230., 9.5, z, 2., asph);
  return col;
}

// ------------------------------------------------ 北京：天安门、广场、故宫、景山
vec3 bjPlaza(vec2 p, float x, float z){
  vec3 stone = vec3(.82,.80,.76);
  vec3 col = s2l(stone*(.95+.06*vn(p*.6)));
  // 天安门广场：浅灰石板 + 方格缝 + 两侧绿带
  if (z > 70. && z < 446.) {
    if (abs(x) < 126.) {
      col = s2l(vec3(.84,.83,.80)*(.96+.05*vn(p*.4)));
      col = mix(col, s2l(vec3(.72,.71,.69)), max(band(mod(x, 8.) - 4., .18, .12), band(mod(z, 8.) - 4., .18, .12))*.35);
      float lawn = max(band(abs(x) - 113., 8., 1.)*step(90., z)*step(z, 430.), 0.);
      lawn = max(lawn, (1.-smoothstep(-1., 1., rectD(x, z, -46., 326., 46., 410.)))*(1.-smoothstep(-1., 1., rectD(x, z, -30., 342., 30., 394.)) ));
      col = mix(col, grass(p, .1), lawn);
    } else {
      col = s2l(vec3(.78,.77,.74)*(.95+.06*vn(p*.5)));
      col = mix(col, grass(p, .2), (1.-smoothstep(-1., 1., rectD(abs(x), z, 140., 92., 240., 430.) ))*.0);
    }
    col = road(col, abs(x) - 131., 4.5, z, 1., vec3(.50,.51,.53));
    col = road(col, z - 448., 5., x, 1., vec3(.50,.51,.53));
  }
  // 金水河（天安门前）：弧形浅绿水带
  if (z > 0. && z < 28.) {
    float wz = z - 14. - 2.5*(x/80.)*(x/80.);
    col = mix(col, s2l(vec3(.40,.60,.56)), band(wz, 2.6, .5)*step(abs(x), 160.));
    col = mix(col, s2l(vec3(.64,.62,.60)), band(abs(wz) - 3., .4, .2)*step(abs(x), 160.));
  }
  // 紫禁城内：灰砖地面、御道、内金水河
  if (z < -270. && z > -790.) {
    col = s2l(vec3(.74,.72,.68)*(.94+.08*vn(p*vec2(1.4,.5))));
    col = mix(col, s2l(vec3(.88,.86,.82)), band(x, 3.2, .4)*step(z, -290.)*step(-760., z));
    if (z < -300. && z > -350. && abs(x) < 70.) {
      float wz = z + 330. - 16.*(1. - (x/70.)*(x/70.));
      col = mix(col, s2l(vec3(.38,.56,.52)), band(wz, 2.4, .4));
      col = mix(col, s2l(vec3(.92,.91,.88)), band(abs(wz) - 2.8, .45, .2));
    }
    // 宫墙与护城河之间的路
    if (abs(x) > 194. || z > -279. || z < -769.) col = s2l(vec3(.70,.69,.66)*(.95+.06*vn(p)));
  }
  // 太庙 / 社稷坛周围的灰砖院落
  return col;
}
vec3 beijing(vec2 p, float oz){
  float x = p.x, z = lmLocal(p.y, oz, ${ORIGIN[1][1].toFixed(1)});
  float k = bjKind(x, z);
  float h = vWPos.y;
  vec3 col;
  vec3 asph = vec3(.50,.51,.53);
  if (k < .5) col = s2l(vec3(.74,.73,.71)*(.95+.06*paint(p)));
  else if (k < 1.2) col = s2l(vec3(.74,.73,.71));
  else if (k < 1.7) col = s2l(vec3(.70,.68,.64)*(.94+.08*vn(p*.5)));
  else if (k < 2.5) col = grass(p, .35 + .5*smoothstep(2., 14., h) + .25*smoothstep(.45,.6,fbm(p*.03)));
  else if (k < 3.5) {
    float sd = min(-bjMoat(x, z), 30.);
    vec3 shal = vec3(.46,.66,.62), deep = vec3(.30,.52,.54);
    col = water(p, deep, shal, sd/14.);
  } else if (k < 4.5) col = bjPlaza(p, x, z);
  else col = s2l(vec3(.66,.64,.61)*(.94+.08*vn(p*.4)));
  // 长安街（双向十车道）
  col = road(col, z - 48., 18., x, 2., asph);
  // 外围大路
  if (z < 28.) col = road(col, x - 266., 5.5, z, 1., asph);
  col = road(col, x + 398., 5.5, z, 1., asph);
  col = road(col, z + 820., 6., x, 1., asph);
  col = road(col, z + 1044., 6., x, 1., asph);
  // 护城河外侧环路
  { float o = rectD(x, z, -226., -801., 226., -245.);
    if (o > 0. && o < 14. && !(z > -250. && abs(x) < 62.)) col = mix(col, road(col, o - 7., 4., x + z, 0., asph), 1.); }
  if (k == 0. || (z > -96. && z < 182. && abs(x) > 255.)) col = road(col, mod(x + 40., 80.) - 40., 3.5, z, 0., asph);
  if (k == 5. || k == 1. || k == 1.5) {
    if (!(abs(x) < 250. && z > -1030. && z < 492.)) col = road(col, mod(x - 20. + 60., 120.) - 60., 3.2, z, 0., asph);
  }
  // 护城河岸
  if (k > 2.5 && k < 3.5) {}
  return col;
}

// ------------------------------------------------ 悉尼：歌剧院、环形码头、海港大桥
vec3 sydney(vec2 q){
  float x = lmLocal(q.y, ${O(3)}), z = SY_X - q.x;
  vec2 p = vec2(x, z);
  float Ld = syLand(x, z);
  if (Ld < 0.) {
    vec3 c = water(p, vec3(.10,.34,.54), vec3(.24,.54,.64), clamp(-Ld/45., 0., 1.));
    // 岸边浪花
    c = mix(c, s2l(vec3(.86,.92,.94)), band(Ld + 1.2 + (vn(p*.3 + uTime*.5)-.5)*1.2, .5, .4)*.6);
    return c;
  }
  float k = syKind(x, z);
  vec3 col = s2l(vec3(.76,.74,.70)*(.95+.06*paint(p)));
  vec3 asph = vec3(.46,.47,.50);
  if (k > 1.5 && k < 2.5) {
    col = grass(p, .15 + .45*smoothstep(.42,.6,fbm(p*.025+1.)));
    float pth = abs(sin(x*.025 + sin(z*.02)*1.4)*24. - z*.3);
    col = mix(col, s2l(vec3(.86,.82,.72)), band(mod(pth, 50.) - 25., 1.4, .5)*.7);
  } else if (k > 3.5) {
    // 歌剧院前的粉色花岗岩台地 / 码头步道
    col = s2l(vec3(.88,.80,.72)*(.95+.06*vn(p*.7)));
    col = mix(col, s2l(vec3(.80,.72,.64)), max(band(mod(x, 7.) - 3.5, .2, .15), band(mod(z, 7.) - 3.5, .2, .15))*.25);
    if (z > 100. && z < 122.) col = road(col, z - 111., 6., x, 1., asph);
  } else if (k > 5.5 && k < 6.5) {
    col = grass(p, .3 + .4*smoothstep(.45,.62,fbm(p*.03)));
  } else if (k < .5) {
    col = s2l(vec3(.78,.70,.60)*(.95+.06*paint(p)));
  }
  if (k != 4.) {
    if (z < -280.) { col = road(col, mod(x - 15. + 45., 90.) - 45., 3., z, 0., asph); col = road(col, mod(z + 25., 50.) - 25., 2.5, x, 0., asph); }
    else if (k != 2.) { col = road(col, mod(x + 42. + 35., 70.) - 35., 3.6, z, 0., asph); col = road(col, mod(z - 18. + 27.5, 55.) - 27.5, 3.6, x, 0., asph); }
  }
  // 大桥引道（布拉德菲尔德公路）
  float bd = syBridge(x, z);
  if (bd < 20.) col = road(col, bd, 11., x*.966 - z*.259, 2., asph);
  // 砂岩海堤
  col = mix(col, s2l(vec3(.86,.76,.58)), 1.-smoothstep(1.6, 2.6, Ld));
  return col;
}

// ------------------------------------------------ 5…14：各城市模块的地面（参数：世界坐标 p、局部 x/z）
${CITIES.map((c) => c.ground).join('\n')}

vec3 groundColor(vec2 p){
  gEm = vec3(0.);
  vec3 c;
  if (uBiome < .5) c = tokyo(p);
  else if (uBiome < 1.5) c = beijing(p, ${ORIGIN[1][0].toFixed(1)});
  else if (uBiome < 2.5) c = beijing(p, ${ORIGIN[2][0].toFixed(1)});
  else if (uBiome < 3.5) c = sydney(p);
${CITIES.map((c, i) => `  else if (uBiome < ${i + 4}.5) c = ${c.groundFn}(p, p.x, lmLocal(p.y, ${O(i + 4)}));`).join('\n')}
  return c * clamp(1. + 1.4*vSlope, .6, 1.4);
}
`;
