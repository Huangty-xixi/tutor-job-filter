#!/usr/bin/env node
/**
 * 无依赖的最小回归测试：从 index.html 里抽出 CONFIG + 解析引擎，用样例跑一遍判定。
 * 用法：node tools/test-engine.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function block(startMark, endMark, name) {
  const i = html.indexOf(startMark);
  const j = html.indexOf(endMark);
  if (i < 0 || j < 0) throw new Error('找不到 ' + name + ' 标记');
  return html.slice(i + startMark.length, j);
}

const configSrc = block('/* CONFIG-START */', '/* CONFIG-END */', 'CONFIG');
const engineSrc = block('/* ENGINE-START */', '/* ENGINE-END */', 'ENGINE');
const load = new Function(configSrc + '\n' + engineSrc + '\nreturn { CONFIG: CONFIG, Engine: Engine };');
const { CONFIG, Engine } = load();

const text = fs.readFileSync(path.join(root, 'sample', 'example-posts.txt'), 'utf8');
const cfg = {
  grades: ['高一', '初一', '初二', '小学'],
  areas: ['1', '5'],
  subjects: ['数学', '奥数', '物理'],
  minPay: CONFIG.defaults.minPay,
  primaryMin: CONFIG.defaults.primaryMin,
  maleOnly: true,
  hardOnly: true
};

let failed = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

const items = Engine.run(text, cfg);
console.log('\n解析到 ' + items.length + ' 条\n');

function byId(id) { return items.find(function (it) { return it.id === id; }); }

check('样例切成 6 条', items.length === 6, String(items.length));

const a = byId('ACS26000001');
check('ACS 单号识别', !!a);
check('ACS 年级=高一', a && a.grade === '高一', a && a.grade);
check('ACS 时薪=100', a && Math.round(a.pay.hourly) === 100, a && a.pay && a.pay.hourly);
check('ACS 位置=岳麓区', a && a.area.name === '岳麓区', a && a.area.name);
check('ACS 判定=可投', a && a.verdict === 'ok', a && [].concat(a.reasons, a.soft).join(';'));

const b = byId('LLS000001');
check('女老师 → 不符合', b && b.verdict === 'bad' && b.reasons.join('').includes('限女老师'), b && b.reasons.join(';'));

const c = byId('b0001');
check('小学五年级数学 60-80/h → 可投', c && c.verdict === 'ok', c && [].concat(c.reasons, c.soft).join(';'));
check('小学按 60 的底线', c && Math.round(c.pay.hourly) === 60, c && c.pay && c.pay.hourly);

const d = byId('0002');
check('五年级英语 → 科目不符', d && d.verdict === 'bad' && d.reasons.join('').includes('科目'), d && d.reasons.join(';'));

const e = byId('WY000003');
check('WY 单号识别 + 200-220/2h 取下限 100', e && e.id === 'WY000003' && Math.round(e.pay.hourly) === 100, e && e.pay && e.pay.hourly);

const f = items[items.length - 1];
check('高三单被排除', f && f.verdict === 'bad' && (f.reasons.join('').includes('年级') || f.reasons.join('').includes('研究生')), f && f.reasons.join(';'));

check('时薪解析：100元一小时', Math.round(Engine.parsePay('工资：100元一小时，每次2小时').hourly) === 100);
check('时薪解析：220/2h', Math.round(Engine.parsePay('价格：220/2h').hourly) === 110);
check('时薪解析：100一次', Math.round(Engine.parsePay('【薪资】100一次').hourly) === 50);
check('时薪解析：400/天', Math.round(Engine.parsePay('课酬：400/天').hourly) === 50);

console.log('\n' + (failed ? '失败 ' + failed + ' 项' : '全部通过'));
process.exit(failed ? 1 : 0);
