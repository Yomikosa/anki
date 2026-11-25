/**
 * 初期サンプル公式（プリセット3件）およびインポート動作確認用サンプルJSON
 * すべての公式はスタサプ風穴埋め記法 {{...}} および KaTeX に対応しています。
 */

export const PRESET_FORMULAS = [
  {
    id: 'preset-quadratic-formula',
    subject: '数学',
    category: '二次方程式',
    title: '二次方程式の解の公式',
    question: '二次方程式 ax² + bx + c = 0（a ≠ 0）の解 x を求めよ。',
    formula: '{{x}} = \\frac{{-b \\pm \\sqrt{b^2 - 4ac}}}{{2a}}',
    explanation:
      '判別式 $D = {{b^2 - 4ac}}$ の符号によって実数解の個数が決まる。$D > 0$ のとき異なる2つの実数解、$D = 0$ のとき{{重解}}、$D < 0$ のとき実数解なしとなる。',
    status: 'unlearned',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'preset-newton-second-law',
    subject: '物理',
    category: '力学',
    title: 'ニュートンの運動方程式',
    question: '質量 m の物体に合力 F が働くときの加速度 a との関係式を答えよ。',
    formula: '{{m}}{{a}} = {{F}}',
    explanation:
      '質量 $m\\ [\\mathrm{kg}]$ の物体に生じる加速度 $a\\ [\\mathrm{m/s^2}]$ は、働く合力 $F\\ [\\mathrm{N}]$ に{{比例}}し、質量 $m$ に{{反比例}}する。加速度の向きは合力の向きと一致する。',
    status: 'unlearned',
    createdAt: '2026-01-01T00:01:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
  },
  {
    id: 'preset-uniform-acceleration',
    subject: '物理',
    category: '力学・等加速度直線運動',
    title: '等加速度直線運動の変位の公式',
    question: '初速度 v₀、加速度 a で時刻 t だけ運動したときの変位 x を求めよ。',
    formula: '{{x}} = {{v_0 t}} + {{\\frac{1}{2} a t^2}}',
    explanation:
      '$v$-$t$ グラフの{{面積}}が変位を表す。初速度による長方形部分 $v_0 t$ と、加速による三角形部分 $\\frac{1}{2} a t^2$ の和になっている。また、時間 $t$ を消去すると ${{v^2 - v_0^2}} = 2ax$ が得られる。',
    status: 'unlearned',
    createdAt: '2026-01-01T00:02:00.000Z',
    updatedAt: '2026-01-01T00:02:00.000Z',
  },
];

/**
 * 「公式を追加（JSON取込）」画面でワンクリックお試し入力できるサンプルJSON
 */
export const SAMPLE_IMPORT_JSON = JSON.stringify(
  [
    {
      subject: '数学',
      category: '三角比',
      title: '余弦定理',
      question: '△ABC において、2辺 b, c とその間の角 A から辺 a を求める式を答えよ。',
      formula: '{{a^2}} = {{b^2 + c^2}} - {{2bc \\cos A}}',
      explanation:
        '$A = 90^\\circ$ のとき $\\cos 90^\\circ = {{0}}$ となるため、{{三平方の定理}} $a^2 = b^2 + c^2$ に一致する。',
    },
    {
      subject: '物理',
      category: '仕事とエネルギー',
      title: '運動エネルギーの公式',
      question: '質量 m、速さ v で運動する物体の運動エネルギー K を求めよ。',
      formula: '{{K}} = {{\\frac{1}{2} m v^2}}',
      explanation:
        '単位はジュール $[\\mathrm{J}]$。速さが2倍になると運動エネルギーは{{4倍}}になる。仕事とエネルギーの関係は $\\Delta K = {{W}}$ である。',
    },
  ],
  null,
  2
);
