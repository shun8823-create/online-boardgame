'use strict';
/* ===== カードデータ ===== */
const CARDS = {};
const D = (id, o) => { CARDS[id] = Object.assign({ id, rank: 1, txt: [], ab: [] }, o); };
/* 属性：キャラクターが所持する属性（同じ属性のスペルは、必要SpCが2以上なら1少なくなる） */
const charAttrs = cid => {
  const c = CARDS[cid], r = String(c.race || ''), a = [];
  if (r.includes('エルフ')) a.push('水', '風');
  if (r.includes('ドワーフ')) a.push('火', '土');
  if (cid === 'iceWitch') a.push('雪');
  if (cid === 'redDragon') a.push('火');
  if (cid === 'stormEagle') a.push('風', '雷');
  return [...new Set(a)];
};
const CH = (id, o) => D(id, Object.assign({ kind: 'char' }, o));

CH('avatar', { name: 'アバター', kind: 'avatar', cat: 'アバター', race: '', lp: 2000, op: 0, dp: 0, sc: 1, spc: 1, txt: ['敗北条件に直結する盤上ユニット。バトルに負けたプレイヤーは敗北する。', '「形質変化」以外のカードの対象にならない。'] });

CH('rookieAdv', { name: '駆け出し冒険者', cat: 'ヒューマノイド', race: 'ヒューム', lp: 3000, op: 0, dp: 0, sc: 1, spc: 0, weapon: true, txt: ['能力なし。武器を装備できる。'] });
CH('rookieMage', { name: '駆け出し魔法使い', cat: 'ヒューマノイド', race: 'ヒューム', lp: 2000, op: 0, dp: 0, sc: 1, spc: 1, weapon: true, ab: ['wizDice'], txt: ['スペルドロー（d4以上）：配置時、サイコロを振り、4以上ならデッキからランク1のスペルをランダムに1枚手札に加える。', '武器を装備できる。'] });
CH('normalGob', { name: 'ノーマルゴブリン', cat: 'モンスター', race: 'ゴブリン', lp: 1500, op: 0, dp: 0, sc: 2, spc: 0, weapon: true, ab: ['goblinSummon'], txt: ['手札に同ランクで種族ゴブリンのカードがあれば、追加で1体配置できる（追加配置の枠は消費しない。連鎖可）。', '武器を装備できる。'] });
CH('hobGob', { name: 'ホブゴブリン', cat: 'モンスター', race: 'ゴブリン', lp: 3000, op: 500, dp: 0, sc: 2, spc: 0, weapon: true, ab: ['hobCond'], txt: ['配置条件：デッキに種族ゴブリンのカードが9枚以上ないと配置できない。', '武器を装備できる。'] });
CH('slime', { name: 'スライム', cat: 'モンスター', race: 'ウーズ', lp: 1000, op: 0, dp: 2000, sc: 1, spc: 1, ab: ['slime'], txt: ['バトル時（攻撃でも防御でも）サイコロを振り、4以上なら相手の「武器」をバトル前に破壊する。'] });
CH('vetAdv', { name: 'ベテラン冒険者', cat: 'ヒューマノイド', race: 'ヒューム', lp: 4000, op: 500, dp: 500, sc: 2, spc: 0, weapon: true, txt: ['デッキ条件：「駆け出し」と名のつくヒューマノイドがデッキに3枚以上ないと入れられない。', '武器を装備できる。'] });
CH('vetMage', { name: 'ベテラン魔法使い', cat: 'ヒューマノイド', race: 'ヒューム', lp: 2500, op: 0, dp: 1000, sc: 2, spc: 2, weapon: true, ab: ['wizDice'], txt: ['デッキ条件：「駆け出し」と名のつくヒューマノイドがデッキに3枚以上ないと入れられない。', 'スペルドロー（d4以上）：配置時、サイコロを振り、4以上ならデッキからランク1のスペルをランダムに1枚手札に加える。', '武器を装備できる。'] });
CH('dwarf', { name: 'ドワーフの戦士', cat: 'ヒューマノイド', race: 'ドワーフ', rank: 2, lp: 4000, op: 0, dp: 1000, sc: 1, spc: 0, weapon: true, ab: ['dwarf'], txt: ['庇護：相手が自分のキャラクターを対象にアイテムを使う時、ゲーム中1度だけ、対象をこのキャラクターに変更できる（相手のキャラクターが対象の時は発動しない）。', '武器を装備できる。'] });
CH('gobWiz', { name: 'ゴブリンウィザード', cat: 'モンスター', race: 'ゴブリン', lp: 1500, op: 0, dp: 0, sc: 2, spc: 1, weapon: true, ab: ['wizDice'], txt: ['スペルドロー（d4以上）：配置時、サイコロを振り、4以上ならデッキからランク1のスペルをランダムに1枚手札に加える。', '武器を装備できる。'] });
CH('ogre', { name: 'オーガ', cat: 'モンスター', race: 'ジャイアント', rank: 2, lp: 5000, op: 0, dp: 0, sc: 2, spc: 2, weapon: true, ab: ['sacrifice'], txt: ['生贄：LP合計1500以上になるよう自分のキャラクターを破壊して配置する。合計4500以上なら2列目にも配置できる。', '武器を装備できる。'] });
CH('redBoar', { name: 'レッドボア', cat: 'モンスター', race: 'ワイルド', rank: 2, lp: 4500, op: 500, dp: 0, sc: 4, spc: 1, ab: ['berserk'], txt: ['狂乱：1マスの代わりに必ず2マス動く（移動のSC+1）。1ターンに1度は必ず移動する（SC不足なら不要）。', '味方は通過できるが同じマスには止まれない。敵は飛び越せない。盤面の端が移動先なら1マスで止まる。'] });
CH('elfMage', { name: 'エルフの魔法使い', cat: 'ヒューマノイド', race: 'エルフ', rank: 2, lp: 2500, op: 0, dp: 2500, sc: 3, spc: 3, weapon: true, wiz: 3, ab: ['magicResist', 'wizDice'], txt: ['魔法耐性：相手のスペルが自分に効く時、消費SpC+1のSpCを支払って打ち消せる（SC代用不可）。', 'スペルドロー（d3以上）：配置時、サイコロを振り、3以上ならデッキからランク1のスペルをランダムに1枚手札に加える。', '武器を装備できる。'] });
CH('redDragon', { name: 'レッドドラゴン', cat: 'モンスター', race: 'ドラゴン', rank: 3, lp: 6000, op: 0, dp: 0, sc: 4, spc: 3, ab: ['incinerate', 'flight', 'magicResist'], txt: ['焼却（永続）：正面のマスの相手キャラクターのLPを、このキャラクターのLP分減らし、正面のマスの相手の設置カードを破壊する。', '飛翔：設置カードの影響を受けない。', '魔法耐性：相手のスペルが自分に効く時、消費SpC+1のSpCを支払って打ち消せる（SC代用不可）。'] });
CH('troll', { name: 'トロール', cat: 'モンスター', race: 'ジャイアント', rank: 2, lp: 5000, op: 0, dp: 0, sc: 1, spc: 0, ab: ['regen'], txt: ['再生：ダメージを受けた後、LPを500回復する（元のLPまで）。'] });
CH('iceWitch', { name: '氷の魔女（アイスウィッチ）', cat: 'モンスター／ヒューマノイド', race: 'アイスウィッチ', rank: 3, lp: 4500, op: 0, dp: 1500, sc: 2, spc: 5, weapon: true, ab: ['witchEtb', 'witchChill', 'superResist'], txt: ['スペルコレクト（d4以上）：配置時、サイコロを振り、4以上ならデッキからランク2のスペルを1枚手札に加える。そうでなければ、ランク1のスペルを1枚手札に加える。', '自分がランク2のスペルを使った時、またはランク1のスペルをそのターンに偶数回目に使った時、相手のキャラクター1体をランダムに「しもやけ」状態にする。', '超魔法耐性：「魔法耐性」と同じだが、支払うSpCは消費SpCと同じで、1ターンに2度まで使える。「魔法耐性」としても扱う。', 'モンスターとヒューマノイドの特性をもつ（武器を装備できる）。'] });
CH('golem1', { name: 'ゴーレム（ステップ1）', token: true, cat: 'モンスター', race: 'オートマトン', lp: 2000, op: 0, dp: 0, sc: 1, spc: 1, rspc: 0, txt: ['配置時に装甲値2000を得る。', 'SpCは1のみ（通常のスペル用）。', '「クリエイトゴーレム」で出る。自分のゴーレムが場にいるなら、新しく出す代わりにステップを1つ進められる。'] });
CH('golem2', { name: 'ゴーレム（ステップ2）', token: true, cat: 'モンスター', race: 'オートマトン', lp: 4000, op: 0, dp: 0, sc: 1, spc: 1, rspc: 1, ab: ['magicResist'], txt: ['ステップ1からLP+2000、耐性SpC+1。', '耐性SpC：魔法耐性・超魔法耐性の支払い専用のSpC（SpCより先に使う）。', '魔法耐性：相手のスペルが自分に効く時、消費SpC+1のSpCを支払って打ち消せる（SC代用不可）。'] });
CH('golem3', { name: 'ゴーレム（ステップ3）', token: true, cat: 'モンスター', race: 'オートマトン', lp: 6000, op: 0, dp: 0, sc: 1, spc: 1, rspc: 2, ab: ['superResist'], txt: ['ステップ2からLP+2000、耐性SpC+1。最終形態。', '耐性SpC：魔法耐性・超魔法耐性の支払い専用のSpC（SpCより先に使う）。', '超魔法耐性：「魔法耐性」と同じだが、支払うSpCは消費SpCと同じで、1ターンに2度まで使える。「魔法耐性」としても扱う。'] });
CH('rookieRanger', { name: '駆け出しレンジャー', cat: 'ヒューマノイド', race: 'ヒューム', lp: 2000, op: 0, dp: 500, sc: 2, spc: 0, weapon: true, archer: 4, ab: ['stealth', 'archer', 'scout'], txt: ['潜伏：配置時、ホームテリトリーの好きなマスに非公開で置ける（場所は相手に伝わる）。非公開中は居ないものとして扱う。配置から自分のターンが3回経過した後、メインステップ中にいつでも公開できる。1ターン1体の配置制限の対象外。', '弓使い（d4以上）：メインステップ中にSC1を支払い、相手のキャラクター1体を対象にサイコロを振る。4以上ならLPを1000減らす。1ターンに1度。', '警戒：メインステップ中にSC1を支払い、相手のホームテリトリーの非公開カード1枚を非公開のまま確認し、印をつける。1キャラクターにつき1ターンに1度。', '武器を装備できる。'] });
CH('darkAssassin', { name: '闇夜の暗殺者', cat: 'ヒューマノイド', race: 'ヒューム', rank: 1, lp: 2500, op: 500, dp: 0, sc: 1, spc: 0, ab: ['darkCond', 'assassin', 'ambush', 'assassinate'], txt: ['配置条件：ホームテリトリーに非公開カードが2枚以上ないと配置できない。', 'アサシン：ホームテリトリーで非公開カードと同じマスにいる間、移動の際に、自分の別の非公開カードのあるマスへ移動できる。「警戒」を受けた非公開カードには使えない。', 'ふいうち：後方にもバトルできる。後方へのバトル中のみOP+1000。', 'LP4000以下のヒュームとバトルする際、バトル前にそのキャラクターを破壊する。'] });
CH('vetRanger', { name: 'ベテランレンジャー', cat: 'ヒューマノイド', race: 'ヒューム', lp: 3000, op: 0, dp: 500, sc: 3, spc: 0, weapon: true, archer: 3, ab: ['stealth', 'archer', 'scout'], txt: ['デッキ条件：「駆け出し」と名のつくヒューマノイドがデッキに3枚以上ないと入れられない。', '潜伏：配置時、ホームテリトリーの好きなマスに非公開で置ける（場所は相手に伝わる）。非公開中は居ないものとして扱う。配置から自分のターンが3回経過した後、メインステップ中にいつでも公開できる。1ターン1体の配置制限の対象外。', '弓使い（d3以上）：メインステップ中にSC1を支払い、相手のキャラクター1体を対象にサイコロを振る。3以上ならLPを1000減らす。1ターンに1度。', '警戒：メインステップ中にSC1を支払い、相手のホームテリトリーの非公開カード1枚を非公開のまま確認し、印をつける。1キャラクターにつき1ターンに1度。', '武器を装備できる。'] });
CH('moonDragon', { name: 'ムーンライトドラゴン', cat: 'モンスター', race: 'ドラゴン', rank: 2, lp: 5000, op: 0, dp: 0, sc: 3, spc: 2, ab: ['moonCond', 'moonReset', 'flight'], txt: ['配置条件：このゲーム中にスペルを3回以上使用していないと配置できない。', '月光：ゲーム中2回まで、メインステップ中にSCを2減らして使える（盤面のこのカードを押して選ぶ）。互いに手札を山札に戻してシャッフルし、3枚ずつ引く。', '飛翔：設置カードの影響を受けない。'] });
CH('stormEagle', { name: '天空の覇者（ストームイーグル）', cat: 'モンスター', race: 'ワイルド', rank: 3, lp: 5000, op: 0, dp: 0, sc: 5, spc: 3, ab: ['haste', 'twoActions', 'magicResist', 'flight'], txt: ['出たターンから移動でき、2回行動できる。', '飛翔：設置カードの影響を受けない。', '魔法耐性：相手のスペルが自分に効く時、消費SpC+1のSpCを支払って打ち消せる（SC代用不可）。'] });
CH('blackWolf', { name: 'ブラックウルフ', cat: 'モンスター', race: 'ワイルド', lp: 2000, op: 1000, dp: 0, sc: 2, spc: 1, ab: ['haste'], txt: ['出たターンから移動できる。'] });
CH('killerTiger', { name: 'キラータイガー', cat: 'モンスター', race: 'ワイルド', lp: 4000, op: 0, dp: 0, sc: 3, spc: 1, ab: ['tigerCond'], txt: ['配置条件：デッキに種族ワイルドのキャラクターが10体以上ないと配置できない。'] });
CH('bloodSnake', { name: 'ブラッドスネーク', cat: 'モンスター', race: 'ワイルド', lp: 1500, op: 1500, dp: 0, sc: 2, spc: 0, ab: ['stealth', 'poisonTouch'], txt: ['潜伏：配置時、ホームテリトリーの好きなマスに非公開で置ける（場所は相手に伝わる）。非公開中は居ないものとして扱う。配置から自分のターンが3回経過した後、メインステップ中にいつでも公開できる。1ターン1体の配置制限の対象外。', 'バトルした相手を「毒」状態にする。'] });
CH('greatMonkey', { name: 'グレートモンキー', cat: 'モンスター', race: 'ワイルド', rank: 2, lp: 4500, op: 0, dp: 0, sc: 3, spc: 1, ab: ['throw'], txt: ['投擲：ゲーム中2回まで、メインステップ中にSCを2減らし、手札にアイテム「投石」を1枚出現させる。'] });
CH('vampire', { name: 'キングヴァンパイア', cat: 'モンスター', race: 'アンデット', rank: 3, lp: 5000, op: 0, dp: 1500, sc: 3, spc: 3, weapon: true, ab: ['sacrifice', 'superRegen', 'magicResist', 'flight', 'kingEtb'], txt: ['生贄：LP合計1500以上になるよう自分のキャラクターを破壊して配置する。合計4500以上なら2列目にも配置できる。', 'テクニックドロー：配置時、デッキ外から「変異」か「発狂」のどちらかを選んで手札に加える（効果を見て選べる）。生贄にしたキャラクターのLP合計3000につき、その回数分さらにこの効果を発動する。', '超再生：ダメージを受けた後、LPを1500回復する（元のLPまで）。', '魔法耐性：相手のスペルが自分に効く時、消費SpC+1のSpCを支払って打ち消せる（SC代用不可）。', '飛翔：設置カードの影響を受けない。', '武器を装備できる。'] });
CH('cockatrice', { name: 'コカトリス', cat: 'モンスター', race: 'マジカルビースト', rank: 2, lp: 3500, op: 0, dp: 0, sc: 2, spc: 1, ab: ['backBattle', 'petrify', 'poisonTouch'], txt: ['後方にもバトルできる。', '目の前のマスに相手のキャラクターが入った時、そのキャラクターを次の相手のターン終了時まで「石化」状態にする。', 'バトルしたキャラクターを「毒」状態にする。'] });

/* スペル */
const SP = (id, o) => D(id, Object.assign({ kind: 'spell' }, o));
SP('createGolem', { name: 'クリエイトゴーレム', cost: 'SpC2（進行は3／4）', attr: '土', txt: ['「ゴーレム（ステップ1）」を自分に最も近い列に出す。', '自分のゴーレムが場にいるなら、代わりにそのステップを1つ進められる。ステップを進める時は消費SpCが増える（ステップ2へ：SpC3、ステップ3へ：SpC4）。', '使用後、墓地の代わりにデッキに戻してシャッフルできる（ゲーム中3回まで。同名カードも合算）。'] });
SP('petrifyRay', { name: '石化光線', cost: 'SpC1', txt: ['相手のキャラクター1体を、次のターンの間「石化」状態にする。'] });
SP('spark', { name: 'スパーク', cost: 'SpC2', attr: '雷', txt: ['相手のキャラクター1体に2000ダメージを与え、「まひ」状態にする。'] });
SP('magicSanctuary', { name: '魔法聖域（スペルサンクチュアリ）', cost: 'SpC1', txt: ['設置：自分のホームテリトリーに置く。', '同じマスにLP4000以下の自分のキャラクターが来た時（後から設置した場合も含む）、非公開にできる。非公開にすると、そのキャラクターのSC・SpCのターン終了時の回復量が1増える。', '非公開中はメインステップ中にいつでも公開できる（公開後は、そのマスを離れて戻るまで再び非公開にできない）。LPが4000を超えると、同じマスに自分のキャラクターがいなければ強制的に公開される。'] });
SP('signpost', { name: '道標（マジックサイン）', cost: 'SpC1', txt: ['カードを2枚引く。'] });
SP('fireball', { name: '火球（ファイアボール）', cost: 'SpC1', attr: '火', txt: ['相手のキャラクター1体に2000ダメージを与え、「やけど」状態にする。'] });
SP('sandWall', { name: '砂壁（サンドウォール）', cost: 'SpC1', attr: '土', txt: ['設置：空きマス1つに置く。そのマスへの侵入・配置はできない。使用ターンを除く自分のターンで3ターン後の終了時に壊れる。'] });
SP('freezeWind', { name: 'フリーズウインド', cost: 'SpC1', attr: '風・雪', txt: ['相手のキャラクター1体のSCを4減らし、「しもやけ」状態にする（すでに「しもやけ」なら「凍傷」状態）。'] });
SP('shiftForm', { name: '形質変化', cost: 'SpC1', equip: true, txt: ['装備魔法：自分のキャラクターまたはアバターに装備する。装備した次のターンから、所持者は斜め前と斜め後ろにだけ動ける。'] });
SP('teleport', { name: 'テレポート', cost: 'SpC2', txt: ['自分のキャラクター2体の位置を入れ替える。'] });
SP('reinforce', { name: '増援召喚', cost: 'SpC2', txt: ['カードを1枚引く。このターン、追加でキャラクターを1体召喚できる。'] });
SP('magicGuard', { name: '魔法壁（マジックガード）', cost: 'SpC1以上', txt: ['自分のキャラクター1体を対象にする。SpC1つ（足りなければSC2）を1回分として、好きな回数分を消費し、1回分につき装甲値1000を与える。', '装甲値：LPとは別の値。あらゆるダメージを先に受ける（使い切り。回復しない）。'] });
SP('chaosHand', { name: '混沌の手（ドレインハンド）', cost: 'SpC1', txt: ['自分と相手のキャラクター1体ずつを対象にする。相手のLPを1000減らし、自分のLPを2ターン後のターン終了時まで1000増やす。'] });
SP('aquaReturn', { name: 'アクアリターン', cost: 'SpC1', attr: '水', txt: ['LP3000以下のキャラクター1体を対象に、手札に戻す。'] });
SP('goldenBody', { name: '黄金の体', rank: 2, cost: 'SpC3', txt: ['自分のキャラクターがバトルする際（相手のターンでも）使用でき、対象はバトルに必ず勝利する。', 'カウンター：対象は「カウンター」を得る（以降ずっと）。相手のターン中にバトルに勝った時、自分の攻撃値（LP+OP）のダメージをバトルした相手に与える。', 'バトル前に手札にあれば、使うかどうか必ず確認される。'] });
SP('instinct', { name: '本能解放', rank: 2, cost: 'SpC2', txt: ['使用から3回目の自分のターン終了時まで、自分のキャラクターがエネミーテリトリーに入った時、そのキャラクターのLPを1000増やす（重複しない）。', '自分の盤面に種族ワイルドが3体以上いるなら永続する。'] });
SP('blizzard', { name: '終焉のブリザード', rank: 2, cost: 'SpC4', attr: '風・雪', txt: ['自分から見てボーダーゾーンとエネミーテリトリーにいる相手のキャラクター全員を「しもやけ」状態にし、SCを3減らす。'] });
SP('thunderStorm', { name: 'サンダーストーム', rank: 2, cost: 'SpC4', attr: '雷', wide: true, txt: ['ホームテリトリーのキャラクターに、このターン中だけ装甲値4000を与える。', '範囲：1〜7列、A〜G列、1〜7列の順にランダムで1列ずつ計3列を選び、その列のキャラクター（自分のも含む）のLPを4000減らす。「飛翔」をもつキャラクターのいる列は、選ばれる確率が2倍。', '超範囲：自分と相手のキャラクターの両方を巻き込んで、ダメージやデバフなどを与える効果をもつカードの印。この言葉自体に効果はない。', 'このカードには「庇護」「魔法耐性」を例外的に使える（確認あり。魔法耐性はSpC2のスペル扱い）。'] });
SP('windSlash', { name: 'ウインドスラッシュ', cost: 'SpC1', attr: '風', equip: true, txt: ['装備魔法：自分のキャラクターに装備する。自分の2ターン後のターン終了時まで持続し、切れると墓地に送られる。', '所持者が1マス進むたび、相手のキャラクター1体に1000ダメージを与える。同じキャラクターに重複して装備できる。'] });
SP('redDragonBreath', { name: 'レッドドラゴンブレス', rank: 2, cost: 'SpC3', attr: '火', equip: true, txt: ['装備魔法：SpCを消費したキャラクターに装備する。自分の2ターン後のターン終了時まで持続し、切れると墓地に送られる。', '装備中、「焼却」を得る。', '焼却：正面のマスの相手キャラクターのLPを、このキャラクターのLP分減らし、正面のマスの相手の設置カードを破壊する。'] });

/* アイテム */
const IT = (id, o) => D(id, Object.assign({ kind: 'item', cost: '' }, o));
IT('swordFine', { name: '上等な剣', sell: 3, weapon: true, wop: 1000, wdp: 1000, txt: ['武器。装備者のOPとDPをそれぞれ1000増やす。'] });
IT('bowFine', { name: '上等な弓', sell: 3, weapon: true, txt: ['武器。装備者が「弓使い」をもつなら、必要なサイコロの出目を2つ少なくする（d4以上→d2以上）。', '「弓使い」をもたないなら「弓使い」（d6以上。種族にエルフをもつなら d4以上）を得る。'] });
IT('thornTrap', { name: '棘付きトラップ', sell: 5, rank: 1, txt: ['設置：自分のホームテリトリーの好きなマスに置く（非公開でもよい。発動時に公開される）。', '同じマスに来た相手のキャラクターのLPを5000減らす。このダメージのうち、回復できるのは2000まで。'] });
IT('wandFine', { name: '上等な魔杖', sell: 4, weapon: true, wspc: 1, txt: ['武器。装備者のSpCの基礎値を1上げる（現在のSpCも1増える）。SpCの基礎値が1以上のキャラクターにしか使えない。'] });
IT('shieldFine', { name: '上等な盾', sell: 3, weapon: true, wdp: 500, txt: ['武器。装備者のDPを500上げ、装甲値1500を与える。装甲値が0になっても破壊されない。', '装甲値：LPとは別の値。あらゆるダメージを先に受ける（使い切り。回復しない）。'] });
IT('stoneThrow', { name: '投石', sell: 0, txt: ['対象のキャラクターに1500ダメージを与える。'] });
IT('staminaPotion', { name: 'スタミナポーション', sell: 2, txt: ['対象のSCを2増やし、LPを1000回復する（元のLPまで）。'] });
IT('magicPotion', { name: 'マジックポーション', sell: 2, txt: ['対象のSpCを1増やし、LPを1000回復する（元のLPまで）。'] });
IT('shopTicket', { name: 'ショップチケット', sell: 0, noSell: true, txt: ['購入権利を1つ得る（購入に使うと消費される）。売ることはできない。', 'カードを売るたびに1枚手に入る。無料の購入権を使い切った後は、購入にこのカードが必要。'] });
IT('elixir', { name: 'エリクサー', sell: 5, rank: 2, txt: ['対象の状態異常を全て治療し、LPを全回復する。さらに、SCを2、SpCを1増やす。'] });
IT('hyperPotion', { name: 'ハイパーポーション', sell: 2, txt: ['対象の状態異常をランダムに1つ治療し、LPを2000回復する（元のLPまで）。'] });
IT('gobFlute', { name: 'ゴブリンの笛', sell: 0, txt: ['自分のデッキまたは墓地から、種族ゴブリンのカードをランダムに2枚手札に加える。'] });

/* テクニック */
const TE = (id, o) => D(id, Object.assign({ kind: 'tech' }, o));
TE('gobParade', { name: 'ゴブリンパレード', rank: 2, cost: 'SC1', cond: '盤面に種族ゴブリンのモンスターが3体以上いる。そのうち1体を選び、SCを1減らす。', txt: ['名前にゴブリンのつくモンスターのLPを、盤面にいる間ずっと1500上げる（今後出すカードにも適用）。'] });
TE('assault', { name: '突撃司令', rank: 2, cost: 'SC1', cond: '同じ種族のキャラクターが3体以上いる。そのうち1体を選び、SCを1減らす。', txt: ['選んだキャラクターと同じ種族の、ホームテリトリーまたはボーダーゾーンのキャラクターが対象。このターン、1マスの代わりに2マス前進する（必ず移動・出したターンでも可・SC不要）。相手のアバターとはバトルできない。', '対象は、この移動以外の移動（2回行動・ハンティング）ができない。'] });
TE('ferocious', { name: '獰猛なる覇者の加護', cost: 'SC1／SpC1', cond: 'ホームテリトリーに、SCとSpCが1以上の種族ワイルドのキャラクターがいる。', txt: ['カードを1枚引く。ホームテリトリーの種族ワイルドのモンスター1体を対象に、LPを500上げ（ステータス上昇。ホームテリトリーを出ても残る）、次の自分のターンの行動回数を1つ増やす（合計2回まで）。', '行動回数の増加は、ホームテリトリーを出ると消える。増えた行動の移動では、アバターとバトルできない。', '対象のSCとSpCを1ずつ消費する。'] });
TE('fightSpirit', { name: '闘争心', cost: 'SC1', cond: '場に種族ワイルドのキャラクターがおり、そのモンスターの現在のSpCが1以上。対象にした自分のキャラクターのSCを1消費する。', txt: ['武器のように装備できる。OPを500増やし、装備した次のターンから「ハンティング」を得る。', 'ハンティング：移動後、1マス以内に相手のキャラクターがいれば、そこへ移動して攻撃してもよい（SCを支払う。行動済みでも可）。1ターンに1度。'] });

/* デッキ外テクニック（デッキ構築には入れられない。使用すると消費される） */
const TK = (id, o) => TE(id, Object.assign({ token: true, sell: 0 }, o));
TK('tkFrenzy', { name: '発狂', cost: 'なし', txt: ['盤上のキャラクター1体を対象にする。次の（そのキャラクターの持ち主の）ターンの間「狂乱」を与える。そのターンの終了時に「狂乱」は無くなる。', '使用すると消費される（墓地に送られない）。'] });
TK('tkAmbush', { name: '奇襲', cost: 'なし', txt: ['盤上のキャラクター1体を対象にする。次の（そのキャラクターの持ち主の）ターンの間「ふいうち」を与える。そのターンの終了時に「ふいうち」は無くなる。', '使用すると消費される（墓地に送られない）。'] });
TK('tkChase', { name: '追跡', cost: 'なし', txt: ['盤上のキャラクター1体を対象にする。次の（そのキャラクターの持ち主の）ターンの間「ハンティング」を与える。そのターンの終了時に「ハンティング」は無くなる。', '使用すると消費される（墓地に送られない）。'] });
TK('tkMutate', { name: '変異', cost: 'なし', txt: ['盤上のキャラクター1体を対象にする。そのキャラクターは次の（持ち主の）ターンのみ、斜め前方・斜め後方にしか進めなくなる。', '使用すると消費される（墓地に送られない）。'] });
TK('tkAgile', { name: '俊敏', cost: 'なし', txt: ['このターンに配置した自分のキャラクター1体を対象にする。そのキャラクターは配置したターンから移動できるようになる。', '使用すると消費される（墓地に送られない）。'] });

const KIND_LABEL = { char: 'キャラクター', avatar: 'アバター', spell: 'スペル', item: 'アイテム', tech: 'テクニック' };

/* ===== デッキ ===== */
const mk = o => Object.entries(o).flatMap(([k, n]) => Array(n).fill(k));
const PRESETS = [
  { id: 'p_oudo', name: '王道デッキ', preset: true, list: { rookieAdv: 1, rookieMage: 2, vetAdv: 3, vetMage: 2, elfMage: 1, dwarf: 2, redDragon: 1, signpost: 3, fireball: 3, sandWall: 2, freezeWind: 2, shiftForm: 1, teleport: 1, goldenBody: 1, swordFine: 2, stoneThrow: 3 } },
  { id: 'p_gob', name: 'ゴブリンデッキ', preset: true, list: { normalGob: 3, hobGob: 3, gobWiz: 3, ogre: 2, vampire: 1, signpost: 3, fireball: 1, freezeWind: 1, chaosHand: 2, shiftForm: 1, reinforce: 2, gobFlute: 3, gobParade: 1, assault: 1, stoneThrow: 3 } },
  { id: 'p_wild', name: 'ワイルドデッキ', preset: true, list: { stormEagle: 1, blackWolf: 3, killerTiger: 3, bloodSnake: 2, greatMonkey: 1, redBoar: 1, signpost: 3, windSlash: 2, sandWall: 1, freezeWind: 1, shiftForm: 1, teleport: 1, assault: 1, fightSpirit: 2, instinct: 1, ferocious: 3, stoneThrow: 3 } },
];
const deckSize = l => Object.values(l).reduce((a, b) => a + b, 0);
function validateDeck(list) {
  const err = [], warn = [];
  const ids = Object.keys(list).filter(k => list[k] > 0);
  const n = deckSize(list);
  if (n !== 30) err.push(`デッキ枚数が${n}枚です（30枚必要）`);
  let r2 = 0, r3 = 0;
  for (const id of ids) {
    const c = CARDS[id], k = list[id];
    if (k > 3) err.push(`「${c.name}」が${k}枚（同名は最大3枚）`);
    if (c.rank === 2) { r2 += k; if (c.kind !== 'char' && k > 1) err.push(`ランク2の${KIND_LABEL[c.kind]}「${c.name}」は同名1枚まで`); }
    if (c.rank === 3) r3 += k;
  }
  if (r2 > 6) err.push(`ランク2が${r2}枚（合計6枚まで）`);
  if (r3 > 1) err.push(`ランク3が${r3}枚（合計1枚まで）`);
  const rookies = ids.filter(id => CARDS[id].name.startsWith('駆け出し') && CARDS[id].cat.includes('ヒューマノイド')).reduce((a, id) => a + list[id], 0);
  for (const id of ['vetAdv', 'vetMage', 'vetRanger']) if (list[id] > 0 && rookies < 3) err.push(`「${CARDS[id].name}」はデッキに「駆け出し」ヒューマノイドが3枚以上必要（現在${rookies}枚）`);
  const gob = ids.filter(id => CARDS[id].race === 'ゴブリン').reduce((a, id) => a + list[id], 0);
  if (list.hobGob > 0 && gob < 9) warn.push(`ホブゴブリンは種族ゴブリンが9枚以上ないと場に出せません（現在${gob}枚）`);
  const wild = ids.filter(id => CARDS[id].race === 'ワイルド' && CARDS[id].kind === 'char').reduce((a, id) => a + list[id], 0);
  if (list.killerTiger > 0 && wild < 10) warn.push(`キラータイガーは種族ワイルドのキャラが10体以上ないと配置できません（現在${wild}体）`);
  return { err, warn, r: [n - r2 - r3, r2, r3] };
}

/* ===== イラスト（SVG） ===== */
const R = (x, y, w, h, f, e = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${e}/>`;
const Ci = (x, y, r, f, e = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" ${e}/>`;
const E = (x, y, rx, ry, f, e = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" ${e}/>`;
const Pa = (d, f, e = '') => `<path d="${d}" fill="${f}" ${e}/>`;
const St = (d, s, w, e = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" ${e}/>`;
const human = (cl, skin = '#e3c39b', top = '') => Pa('M76 120 L86 64 Q100 56 114 64 L124 120Z', cl) + Ci(100, 48, 12, skin) + top;
const hat = c => Pa('M86 42 L102 8 L114 42Z', c) + E(100, 42, 21, 5, c);
const swordG = (x = 132) => Pa(`M${x - 2} 26 L${x + 2} 26 L${x + 4} 92 L${x - 4} 92Z`, '#dfe5e8') + R(x - 10, 92, 20, 4, '#b8963e') + R(x - 3, 96, 6, 14, '#6b4a2a');
const staffG = (x = 132, c = '#9b7bff') => R(x - 2, 30, 4, 84, '#6b4a2a') + Ci(x, 26, 8, c, 'opacity=".9"');
const gobHead = (x, y, s = 1) => Ci(x, y, 14 * s, '#6e9b3b') + Pa(`M${x - 12 * s} ${y - 4 * s} L${x - 34 * s} ${y - 12 * s} L${x - 12 * s} ${y + 6 * s}Z`, '#6e9b3b') + Pa(`M${x + 12 * s} ${y - 4 * s} L${x + 34 * s} ${y - 12 * s} L${x + 12 * s} ${y + 6 * s}Z`, '#6e9b3b') + Ci(x - 5 * s, y - 2 * s, 2.5 * s, '#ffe14d') + Ci(x + 5 * s, y - 2 * s, 2.5 * s, '#ffe14d');
const MOT = {
  avatar: () => human('#3b2f6b', '#e3c39b', Pa('M88 38 L92 26 L98 34 L100 24 L102 34 L108 26 L112 38Z', '#d9b84a')) + swordG(130),
  rookieAdv: () => human('#7a5a3a') + swordG(130) + Pa('M66 70 L88 66 L88 100 L70 96Z', '#8a9299'),
  rookieMage: () => human('#5a46a8', '#e3c39b', hat('#3c2f80')) + staffG(132),
  normalGob: () => Pa('M80 120 L88 70 L112 70 L120 120Z', '#5a4a30') + gobHead(100, 52) + R(128, 60, 4, 50, '#6b4a2a'),
  hobGob: () => Pa('M70 120 L82 66 L118 66 L130 120Z', '#6a4a2a') + gobHead(100, 48, 1.3) + Pa('M126 40 L132 40 L134 100 L124 100Z', '#9aa3a8'),
  slime: () => Pa('M40 112 Q50 44 100 44 Q150 44 160 112Z', '#5fd1b3', 'opacity=".9"') + Ci(84, 78, 6, '#fff') + Ci(116, 78, 6, '#fff') + Ci(84, 79, 3, '#123') + Ci(116, 79, 3, '#123') + Pa('M60 60 Q70 52 84 54', 'none', 'stroke="#c9fff0" stroke-width="4"'),
  darkAssassin: () => human('#1c1c2a', '#d8b894', Pa('M84 50 Q100 24 116 50 L110 56 Q100 44 90 56Z', '#101018')) + St('M132 40 L150 104', '#cfd6d9', 3) + St('M128 100 L138 96', '#6a4a2a', 3) + Ci(94, 48, 2, '#c43030') + Ci(106, 48, 2, '#c43030'),
  rookieRanger: () => human('#3f6a3a', '#e3c39b', Pa('M86 44 Q100 24 114 44 L110 50 Q100 40 90 50Z', '#2a4a26')) + St('M136 30 Q158 70 136 112', '#8a5a2a', 4) + St('M136 30 L136 112', '#e8e0c0', 1.5) + St('M108 70 L150 70', '#c9b27a', 2) + Pa('M150 66 L158 70 L150 74Z', '#cfd6d9'),
  vetRanger: () => human('#2f5a3a', '#e3c39b', Pa('M84 46 Q100 18 116 46 L110 52 Q100 38 90 52Z', '#1f3a22') + Pa('M88 40 Q100 30 112 40', '#1f3a22')) + St('M138 24 Q164 68 138 114', '#7a4a1e', 5) + St('M138 24 L138 114', '#e8e0c0', 1.5) + St('M104 68 L156 68', '#c9b27a', 2) + Pa('M156 64 L166 68 L156 72Z', '#cfd6d9') + Pa('M62 80 L76 84 L72 108 L62 102Z', '#5a4a2a'),
  bowFine: () => St('M60 14 Q150 60 60 108', '#8a5a2a', 7) + St('M60 14 Q150 60 60 108', '#c89a52', 3) + St('M60 14 L60 108', '#efe8cc', 1.5) + St('M60 60 L150 60', '#c9b27a', 3) + Pa('M150 55 L166 60 L150 65Z', '#dfe5e8') + Pa('M62 55 L52 60 L62 65Z', '#b84a3a'),
  vetAdv: () => human('#40536b') + Pa('M86 40 Q100 22 114 40Z', '#8a9299') + swordG(132) + Pa('M62 66 L88 62 L88 104 Q74 110 64 96Z', '#7d8790'),
  vetMage: () => human('#2e5b8a', '#e3c39b', hat('#1f3d66')) + Pa('M88 52 Q100 78 112 52Z', '#ddd') + staffG(134, '#6fd2ff'),
  dwarf: () => Pa('M66 120 L76 74 L124 74 L134 120Z', '#7a5a3a') + Ci(100, 58, 14, '#e3b78f') + Pa('M84 60 Q100 100 116 60Z', '#b0592b') + Pa('M84 54 Q100 28 116 54Z', '#8a9299') + R(130, 50, 6, 50, '#6b4a2a') + Pa('M126 44 L146 44 L146 62 L126 62Z', '#9aa3a8'),
  gobWiz: () => Pa('M80 120 L88 70 L112 70 L120 120Z', '#3b3a6a') + gobHead(100, 54) + hat('#4a3a8a') + staffG(132, '#ffb84d'),
  ogre: () => Pa('M50 120 L62 58 L138 58 L150 120Z', '#7a7a4a') + Ci(100, 44, 22, '#8a9a58') + Pa('M86 54 L90 66 L94 54Z M106 54 L110 66 L114 54Z', '#fff') + Ci(92, 40, 3, '#ffe14d') + Ci(108, 40, 3, '#ffe14d') + R(150, 30, 8, 80, '#5b3f22') + E(154, 30, 16, 12, '#6b4a2a'),
  redBoar: () => E(100, 82, 52, 30, '#9a3b2a') + Ci(60, 76, 22, '#8a3224') + Pa('M52 84 L36 96 L58 92Z', '#f2ead0') + Pa('M66 84 L56 100 L74 90Z', '#f2ead0') + Ci(58, 70, 3, '#ffe14d') + Pa('M70 56 L84 66 L74 70Z', '#6b2218') + Pa('M110 52 L116 66 L124 54 L130 66 L138 52', 'none', 'stroke="#d8c08a" stroke-width="3"'),
  elfMage: () => human('#2f7a4f', '#f0d6b3', Pa('M86 46 L70 40 L88 54Z M114 46 L130 40 L112 54Z', '#f0d6b3') + Pa('M88 44 Q100 30 112 44 L112 38 Q100 24 88 38Z', '#e8d56a')) + staffG(134, '#8dffb0'),
  redDragon: () => Pa('M20 40 Q60 10 96 60 L96 80 Q60 50 30 66Z', '#8a1f1a') + Pa('M180 40 Q140 10 104 60 L104 80 Q140 50 170 66Z', '#8a1f1a') + E(100, 84, 26, 30, '#b8302a') + Pa('M84 66 Q100 20 116 66Z', '#c43a2e') + Pa('M92 44 L86 28 L98 40Z M108 44 L114 28 L102 40Z', '#f2ead0') + Ci(93, 52, 2.5, '#ffe14d') + Ci(107, 52, 2.5, '#ffe14d') + Pa('M90 74 Q100 96 110 74Z', '#ff9a2e'),
  troll: () => Pa('M44 120 L58 62 L142 62 L156 120Z', '#5e6b4a') + Ci(100, 44, 24, '#7d8a64') + Pa('M80 36 L74 22 L88 32Z M120 36 L126 22 L112 32Z', '#4a5238') + Ci(91, 42, 3.5, '#ffd24d') + Ci(109, 42, 3.5, '#ffd24d') + Pa('M88 56 Q100 66 112 56 L110 62 Q100 70 90 62Z', '#2a2a1a') + Pa('M92 56 L95 63 L98 56Z M102 56 L105 63 L108 56Z', '#f2ead0') + E(60, 92, 14, 18, '#6c7858') + E(140, 92, 14, 18, '#6c7858') + R(150, 40, 8, 74, '#5b3f22') + E(154, 38, 14, 12, '#6b4a2a') + St('M72 80 Q80 90 74 100 M128 80 Q120 90 126 100', '#a9d08a', 3),
  iceWitch: () => Pa('M60 120 L76 66 L124 66 L140 120Z', '#3a5a9a') + Pa('M84 70 Q100 100 116 70Z', '#cfe8ff', 'opacity=".5"') + Ci(100, 50, 13, '#e8f1ff') + Pa('M84 48 Q100 12 116 48 L112 40 Q100 22 88 40Z', '#dff3ff') + Pa('M80 46 Q100 8 120 46 L112 44 Q100 20 88 44Z', '#6f9fe0') + Ci(95, 50, 2, '#4fd0ff') + Ci(105, 50, 2, '#4fd0ff') + R(138, 30, 4, 86, '#9fc4e8') + Pa('M140 12 L150 28 L140 40 L130 28Z', '#bff0ff') + St('M30 30 L40 40 M40 30 L30 40 M160 80 L170 90 M170 80 L160 90', '#e8f6ff', 3) + Ci(40, 80, 3, '#fff') + Ci(168, 50, 3, '#fff'),
  golem1: () => R(70, 50, 60, 56, '#8a7a62') + R(60, 60, 14, 38, '#7a6a52') + R(126, 60, 14, 38, '#7a6a52') + R(82, 24, 36, 28, '#9a8a70') + Ci(92, 38, 3.5, '#ffb84d') + Ci(108, 38, 3.5, '#ffb84d') + St('M78 70 L122 70 M78 84 L122 84', '#5a4a38', 3),
  golem2: () => R(62, 46, 76, 62, '#8aa0b0') + R(48, 56, 18, 44, '#7a90a0') + R(134, 56, 18, 44, '#7a90a0') + R(80, 18, 40, 32, '#a8bccb') + Ci(91, 34, 4, '#6fd8ff') + Ci(109, 34, 4, '#6fd8ff') + St('M70 64 L130 64 M70 80 L130 80 M100 50 L100 108', '#4a6070', 3) + Pa('M100 72 L108 82 L100 92 L92 82Z', '#6fd8ff'),
  golem3: () => R(54, 40, 92, 70, '#c8a84a') + R(36, 52, 22, 52, '#b89838') + R(142, 52, 22, 52, '#b89838') + R(76, 10, 48, 34, '#e0c060') + Pa('M76 12 L86 0 L94 12 M106 12 L114 0 L124 12', '#f5e08a') + Ci(89, 28, 4.5, '#ff6a4d') + Ci(111, 28, 4.5, '#ff6a4d') + St('M62 60 L138 60 M62 78 L138 78 M62 96 L138 96', '#7a6020', 3) + Pa('M100 62 L112 76 L100 90 L88 76Z', '#fff2a0') + St('M20 30 L30 40 M170 30 L180 40', '#fff2a0', 3),
  createGolem: () => R(70, 60, 60, 44, '#8a7a62') + R(82, 30, 36, 28, '#9a8a70') + Ci(92, 44, 3, '#ffb84d') + Ci(108, 44, 3, '#ffb84d') + St('M30 30 L50 50 M170 30 L150 50 M100 8 L100 26', '#ffe9a0', 3) + Ci(30, 30, 4, '#ffe9a0') + Ci(170, 30, 4, '#ffe9a0'),
  moonDragon: () => Ci(144, 36, 22, '#f4ecc4') + Ci(152, 32, 19, '#1d2850') + Pa('M16 80 Q56 30 96 66 L96 84 Q56 60 26 90Z', '#3a4a9a') + Pa('M184 80 Q144 40 104 66 L104 84 Q144 62 174 90Z', '#3a4a9a') + E(100, 86, 24, 28, '#5a6ac0') + Pa('M84 70 Q100 24 116 70Z', '#6a7ad0') + Pa('M90 48 L84 30 L96 42Z M110 48 L116 30 L104 42Z', '#e8ecff') + Ci(93, 54, 2.5, '#ffe9a0') + Ci(107, 54, 2.5, '#ffe9a0') + St('M10 20 L16 26 M30 14 L34 20', '#e8ecff', 2),
  blizzard: () => St('M10 40 Q60 10 110 44 T190 30', '#e8f6ff', 6) + St('M6 70 Q60 44 110 74 T194 60', '#9fd0ff', 6) + St('M10 100 Q60 80 100 102 T190 94', '#cfeaff', 5) + Pa('M60 30 L64 42 L76 42 L66 50 L70 62 L60 54 L50 62 L54 50 L44 42 L56 42Z', '#fff') + Pa('M140 56 L143 64 L152 64 L145 70 L148 78 L140 73 L132 78 L135 70 L128 64 L137 64Z', '#fff') + Ci(110, 90, 3, '#fff') + Ci(30, 92, 3, '#fff') + Ci(170, 100, 3, '#fff'),
  thunderStorm: () => Pa('M0 0 H200 V50 Q150 60 100 40 Q50 60 0 46Z', '#2a2f4a') + Pa('M96 20 L72 66 L96 66 L80 118 L130 56 L106 56 L124 20Z', '#ffe14d') + Pa('M96 20 L72 66 L96 66 L80 118 L130 56 L106 56 L124 20Z', 'none', 'stroke="#fff6b0" stroke-width="2"') + St('M30 58 L24 80 L34 80 L28 100 M170 60 L176 82 L166 82 L172 100', '#fff2a0', 3),
  stormEagle: () => Pa('M10 60 Q50 20 98 62 L98 74 Q60 56 20 78Z', '#3d6fb0') + Pa('M190 60 Q150 20 102 62 L102 74 Q140 56 180 78Z', '#3d6fb0') + E(100, 66, 12, 26, '#e8eef2') + Ci(100, 42, 11, '#f4f7f9') + Pa('M96 44 L104 44 L100 56Z', '#e0a23a') + Ci(96, 40, 2, '#123') + Ci(104, 40, 2, '#123') + Pa('M88 90 L112 90 L100 116Z', '#cdd8e0') + St('M30 28 L60 48 M170 28 L140 48', '#bfe4ff', 3),
  blackWolf: () => E(104, 86, 42, 22, '#2b2f36') + Ci(60, 66, 20, '#343942') + Pa('M46 52 L50 34 L60 50Z M66 50 L74 34 L76 54Z', '#2b2f36') + Pa('M42 68 L24 76 L44 78Z', '#343942') + Ci(54, 62, 3, '#ffd24d') + Pa('M140 80 Q170 60 176 40', 'none', 'stroke="#2b2f36" stroke-width="9" stroke-linecap="round"') + R(76, 98, 6, 18, '#2b2f36') + R(120, 98, 6, 18, '#2b2f36'),
  killerTiger: () => E(104, 82, 46, 26, '#d98a2b') + Ci(58, 66, 22, '#e29a3a') + Pa('M44 52 L48 36 L60 50Z M70 50 L76 36 L78 54Z', '#d98a2b') + Ci(52, 62, 3, '#fff0a0') + Ci(66, 62, 3, '#fff0a0') + Pa('M52 76 L58 90 L64 76Z', '#fff') + St('M90 62 L96 80 M106 60 L112 82 M122 62 L126 82 M138 66 L140 84', '#2a1a10', 5),
  bloodSnake: () => St('M30 100 Q70 40 100 80 T170 50', '#7a2a6a', 16) + St('M30 100 Q70 40 100 80 T170 50', '#b04a96', 6) + Ci(172, 48, 11, '#8a2f78') + Ci(176, 44, 2.5, '#ffe14d') + St('M180 52 L192 56 M192 56 L198 52 M192 56 L198 60', '#d33', 2),
  greatMonkey: () => E(100, 92, 30, 24, '#7a4f2a') + Ci(100, 52, 20, '#8a5a30') + E(100, 58, 13, 11, '#e2b88f') + Ci(93, 50, 3, '#123') + Ci(107, 50, 3, '#123') + Ci(78, 50, 8, '#8a5a30') + Ci(122, 50, 8, '#8a5a30') + St('M130 96 Q166 90 164 60', '#7a4f2a', 8),
  vampire: () => Pa('M30 120 L76 60 L100 70 L124 60 L170 120Z', '#1c1624') + Pa('M80 120 L88 66 L112 66 L120 120Z', '#3a1430') + Ci(100, 48, 12, '#e9e2e6') + Pa('M90 42 Q100 28 110 42 L110 36 Q100 24 90 36Z', '#15101a') + Ci(95, 48, 2, '#e22') + Ci(105, 48, 2, '#e22') + Pa('M97 56 L99 62 L101 56Z', '#fff'),
  cockatrice: () => E(96, 82, 34, 26, '#8a7a3a') + Ci(66, 52, 16, '#a08a44') + Pa('M58 40 L62 26 L70 38 L76 28 L78 42Z', '#c9302a') + Pa('M50 54 L36 58 L50 62Z', '#e0a23a') + Ci(62, 50, 3, '#ffe14d') + St('M128 86 Q166 96 150 60 Q144 48 160 40', '#5c8a3a', 8) + Pa('M70 110 L74 120 M96 110 L100 120', 'none', 'stroke="#c9a23a" stroke-width="3"'),
  signpost: () => R(96, 30, 8, 90, '#6b4a2a') + Pa('M58 36 L112 36 L124 46 L112 56 L58 56Z', '#b88a4a') + Pa('M142 62 L92 62 L80 72 L92 82 L142 82Z', '#a67a3c') + Ci(160, 22, 6, '#ffe9a0', 'opacity=".8"') + Ci(40, 30, 4, '#ffe9a0', 'opacity=".7"'),
  fireball: () => Ci(100, 66, 34, '#ff7a1a') + Ci(100, 66, 22, '#ffc23a') + Ci(100, 66, 10, '#fff4c2') + Pa('M70 50 Q60 20 90 30 Q80 40 90 50Z M120 44 Q140 16 150 34 Q136 40 132 54Z', '#ff5a1a') + St('M30 100 Q60 90 70 80', '#ff9a2e', 5),
  sandWall: () => R(50, 40, 100, 70, '#b89a62') + St('M50 62 H150 M50 84 H150 M80 40 V62 M120 62 V84 M80 84 V110', '#8a6f3e', 3) + Pa('M30 110 Q70 90 100 104 T170 108 L170 120 L30 120Z', '#d8bd84', 'opacity=".8"'),
  freezeWind: () => St('M20 50 Q70 30 110 54 T180 40', '#cfeaff', 5) + St('M30 76 Q80 56 120 80 T186 66', '#9fd0ff', 5) + St('M20 100 Q70 84 100 100 T170 94', '#e8f6ff', 4) + Pa('M150 24 L154 34 L164 34 L156 40 L160 50 L150 44 L140 50 L144 40 L136 34 L146 34Z', '#fff'),
  shiftForm: () => St('M50 100 L100 50 L150 100', '#c9a6ff', 7) + Pa('M100 36 L116 54 L84 54Z', '#c9a6ff') + St('M40 40 L70 70 M160 40 L130 70', '#7a5acf', 4) + Ci(100, 86, 12, '#6a3fbf', 'opacity=".7"'),
  teleport: () => Ci(60, 70, 26, 'none', 'stroke="#7fd0ff" stroke-width="5"') + Ci(140, 70, 26, 'none', 'stroke="#ffb26a" stroke-width="5"') + St('M86 56 Q100 40 114 56 M114 84 Q100 100 86 84', '#fff', 4) + Pa('M114 56 L106 48 L108 60Z M86 84 L94 92 L92 80Z', '#fff'),
  reinforce: () => human('#7a5a3a') + Pa('M30 120 L40 80 L60 80 L70 120Z', '#5a46a8') + Pa('M130 120 L140 80 L160 80 L170 120Z', '#2f7a4f') + Ci(50, 68, 8, '#e3c39b') + Ci(150, 68, 8, '#e3c39b') + Pa('M100 6 L108 20 L92 20Z', '#ffe9a0'),
  magicGuard: () => Pa('M40 110 Q40 30 100 20 Q160 30 160 110Z', '#6fa8ff', 'opacity=".45"') + Pa('M60 110 Q60 44 100 36 Q140 44 140 110Z', '#9cc4ff', 'opacity=".5"') + Pa('M100 50 L120 60 L116 90 L100 100 L84 90 L80 60Z', '#d6e6ff') + St('M100 56 V94', '#4f7acf', 3),
  chaosHand: () => Pa('M70 120 L76 70 L70 44 L80 40 L86 64 L88 30 L98 30 L98 62 L106 28 L116 30 L112 64 L124 40 L132 46 L120 76 L126 120Z', '#7a3fbf') + Ci(100, 60, 30, '#c9a6ff', 'opacity=".25"') + St('M40 40 Q60 20 80 30 M160 36 Q140 18 124 28', '#e0c8ff', 3),
  aquaReturn: () => St('M60 96 Q60 40 100 40 Q140 40 140 80', '#6fd0ff', 8) + Pa('M140 80 L128 72 L150 68Z', '#6fd0ff') + Pa('M90 110 Q100 84 110 110Z', '#9fe0ff') + St('M40 110 Q70 98 100 110 T160 110', '#bfeaff', 4),
  goldenBody: () => human('#e0b84a', '#f4dc8a') + Pa('M76 120 L86 64 Q100 56 114 64 L124 120Z', '#ffe27a', 'opacity=".5"') + Ci(100, 70, 46, 'none', 'stroke="#ffe27a" stroke-width="3" opacity=".7"') + St('M100 6 V22 M40 30 L52 40 M160 30 L148 40', '#ffe27a', 4),
  instinct: () => Pa('M100 36 Q120 40 126 60 Q130 84 100 96 Q70 84 74 60 Q80 40 100 36Z', '#d98a2b') + Pa('M80 52 L72 34 L88 46Z M120 52 L128 34 L112 46Z', '#d98a2b') + Ci(90, 64, 3, '#fff') + Ci(110, 64, 3, '#fff') + Pa('M92 78 L100 84 L108 78', 'none', 'stroke="#2a1a10" stroke-width="3"') + St('M30 96 Q60 70 74 50 M170 96 Q140 70 126 50', '#ffd24d', 4),
  spark: () => Pa('M110 14 L70 80 L98 80 L84 128 L134 58 L104 58 L124 14Z', '#ffe04a') + St('M110 14 L70 80 L98 80 L84 128 L134 58 L104 58 L124 14Z', '#fff7c0', 2),
  redDragonBreath: () => Pa('M100 20 Q150 50 140 100 Q130 130 100 128 Q70 130 60 100 Q50 50 100 20Z', '#e0481a') + Pa('M100 46 Q128 66 122 100 Q116 118 100 116 Q84 118 78 100 Q72 66 100 46Z', '#ffa02a') + Pa('M100 74 Q112 88 108 104 Q100 112 92 104 Q88 88 100 74Z', '#ffe27a'),
  windSlash: () => St('M30 100 Q90 70 170 24', '#bff0d0', 8) + St('M30 110 Q96 84 176 44', '#6fd6a0', 5) + St('M50 84 Q100 60 160 20', '#fff', 3),
  swordFine: () => Pa('M96 10 L104 10 L108 82 L92 82Z', '#e6ecef') + R(72, 82, 56, 7, '#b8963e') + R(95, 89, 10, 22, '#6b4a2a') + Ci(100, 114, 5, '#b8963e') + St('M100 14 V80', '#9aa3a8', 2),
  wandFine: () => R(97, 34, 6, 84, '#6b4a2a') + Ci(100, 28, 15, '#7f5cff', 'opacity=".95"') + Ci(100, 28, 8, '#d6c9ff') + Pa('M82 40 Q100 52 118 40 L112 46 Q100 56 88 46Z', '#b8963e') + St('M60 18 L68 26 M140 18 L132 26 M52 44 L64 44 M148 44 L136 44', '#c9a6ff', 3) + Ci(60, 80, 3, '#d6c9ff') + Ci(142, 90, 4, '#d6c9ff'),
  shieldFine: () => Pa('M50 24 L150 24 L146 78 Q100 116 54 78Z', '#8a9299') + Pa('M60 32 L140 32 L137 74 Q100 104 63 74Z', '#aeb7bc') + St('M100 32 V100 M60 56 H140', '#6c747a', 4) + Ci(100, 56, 8, '#c5a66a'),
  stoneThrow: () => Pa('M60 84 Q56 50 90 44 Q124 40 134 70 Q140 98 100 104 Q68 108 60 84Z', '#8a8f94') + Pa('M76 62 Q90 54 104 58', 'none', 'stroke="#b5babe" stroke-width="4"') + St('M140 70 L184 50 M140 84 L186 80', '#d6d9dc', 3),
  staminaPotion: () => Pa('M88 30 H112 V50 Q132 62 130 90 Q128 112 100 112 Q72 112 70 90 Q68 62 88 50Z', '#4fcf6a', 'opacity=".9"') + R(86, 20, 28, 12, '#8a6a3a') + Ci(90, 86, 6, '#c9ffd6', 'opacity=".7"'),
  magicPotion: () => Pa('M88 30 H112 V50 Q132 62 130 90 Q128 112 100 112 Q72 112 70 90 Q68 62 88 50Z', '#6a7aff', 'opacity=".9"') + R(86, 20, 28, 12, '#8a6a3a') + Ci(90, 86, 6, '#d6dcff', 'opacity=".7"') + Pa('M150 30 L154 40 L164 40 L156 46 L160 56 L150 50 L140 56 L144 46 L136 40 L146 40Z', '#ffe9a0'),
  hyperPotion: () => Pa('M88 30 H112 V50 Q132 62 130 90 Q128 112 100 112 Q72 112 70 90 Q68 62 88 50Z', '#ff6ad0', 'opacity=".9"') + R(86, 20, 28, 12, '#c5a66a') + R(96, 72, 8, 24, '#fff') + R(88, 80, 24, 8, '#fff'),
  gobFlute: () => R(40, 62, 120, 12, '#c9a46a') + Ci(60, 68, 3, '#3a2a14') + Ci(80, 68, 3, '#3a2a14') + Ci(100, 68, 3, '#3a2a14') + St('M168 56 Q182 44 176 30 M174 70 Q192 66 190 48', '#9fd05a', 3) + gobHead(40, 36, .6),
  gobParade: () => R(60, 20, 4, 96, '#6b4a2a') + Pa('M64 24 L150 34 L64 56Z', '#5a8a2a') + gobHead(40, 100, .7) + gobHead(80, 106, .7) + gobHead(124, 102, .7) + Ci(104, 36, 6, '#ffe14d'),
  assault: () => St('M30 90 L170 90', '#c43a2e', 6) + Pa('M170 70 L196 90 L170 110Z', '#c43a2e') + St('M30 60 L150 60 M30 120 L150 120', '#e8a090', 4) + Pa('M20 20 L48 20 L34 40Z', '#ffe9a0'),
  ferocious: () => Pa('M40 100 Q60 40 100 30 Q140 40 160 100 Q130 86 100 90 Q70 86 40 100Z', '#7a4a1a') + Pa('M70 54 L62 30 L84 46Z M130 54 L138 30 L116 46Z', '#5a3210') + Ci(86, 62, 4, '#ffd24d') + Ci(114, 62, 4, '#ffd24d') + Pa('M88 78 L94 92 L100 78 L106 92 L112 78Z', '#f2ead0') + St('M30 30 Q100 0 170 30', '#ffe9a0', 4) + St('M20 60 L36 52 M180 60 L164 52', '#ffe9a0', 3),
  petrifyRay: () => St('M20 100 L110 50', '#fff6b0', 7) + St('M20 100 L110 50', '#ffe14d', 3) + Ci(150, 56, 26, '#8a8a82') + Ci(150, 56, 20, '#a6a69c') + Pa('M138 42 L162 42 L158 70 L142 70Z', '#7a7a72') + St('M130 90 L170 30 M126 60 L176 70', '#5e5e58', 2) + Ci(24, 100, 8, '#fff2a0'),
  elixir: () => Pa('M88 24 H112 V46 Q140 58 138 92 Q136 112 100 112 Q64 112 62 92 Q60 58 88 46Z', '#e9f6ff', 'opacity=".25"') + Pa('M70 78 Q100 66 130 78 Q132 104 100 108 Q68 104 70 78Z', '#7de0b0') + Pa('M92 14 H108 V26 H92Z', '#c9a24a') + Ci(92, 90, 3, '#fff') + Ci(110, 84, 2.5, '#fff') + Ci(104, 98, 2, '#fff') + St('M100 56 L100 40 M60 40 L66 48 M140 40 L134 48', '#fff6b0', 3),
  thornTrap: () => Pa('M30 120 L100 120 L100 100Z', '#8a8a92') + Pa('M60 120 L84 52 L108 120Z', '#b8bcc4') + Pa('M96 120 L120 64 L144 120Z', '#8a8e98') + Pa('M126 120 L146 76 L166 120Z', '#b8bcc4') + St('M20 122 L180 122', '#5a4a32', 6) + Ci(84, 52, 3, '#c43030'),
  magicSanctuary: () => Ci(100, 70, 40, 'none', 'stroke="#bfe0ff" stroke-width="3" stroke-dasharray="6 5"') + Ci(100, 70, 26, '#6fa8e0', 'opacity=".25"') + Pa('M100 38 L106 62 L130 70 L106 78 L100 102 L94 78 L70 70 L94 62Z', '#e6f4ff') + R(40, 40, 8, 64, '#8a96a8') + R(152, 40, 8, 64, '#8a96a8') + Pa('M36 40 H52 L44 28Z M148 40 H164 L156 28Z', '#b8c4d4') + Ci(24, 22, 3, '#fff') + Ci(176, 24, 3, '#fff'),
  fightSpirit: () => Pa('M60 60 Q100 20 140 60 Q130 100 100 108 Q70 100 60 60Z', '#a52a2a') + Pa('M80 70 L88 90 L96 70Z M104 70 L112 90 L120 70Z', '#fff') + Ci(84, 56, 4, '#ffd24d') + Ci(116, 56, 4, '#ffd24d') + St('M40 40 Q60 30 70 50 M160 40 Q140 30 130 50', '#ff7a1a', 5),
};
const ART = {
  avatar: ['#2a2350', '#0e0c1e'], rookieAdv: ['#6a8a5a', '#2a3a28'], rookieMage: ['#4a4a8a', '#171533'], normalGob: ['#5a6a3a', '#1c2412'], hobGob: ['#6a5a3a', '#201a0e'], slime: ['#2f6a6a', '#0e2424'],
  darkAssassin: ['#4a3a6a', '#0c0a18'], rookieRanger: ['#4a7a4a', '#12241a'], vetRanger: ['#3a6a4a', '#0e2216'], bowFine: ['#8a6a3a', '#22180c'], vetAdv: ['#7a7a8a', '#262633'], vetMage: ['#3a6a9a', '#10203a'], dwarf: ['#8a5a3a', '#2a1a10'], gobWiz: ['#4a4a6a', '#14142a'], ogre: ['#6a6a3a', '#1c1c0e'], redBoar: ['#8a4a3a', '#2a1410'],
  elfMage: ['#3a7a5a', '#10281c'], redDragon: ['#8a2a1a', '#2a0a06'], iceWitch: ['#4a7ac0', '#0c1a38'], golem1: ['#7a6a4a', '#1c160c'], golem2: ['#5a7a9a', '#0c1822'], golem3: ['#b8963a', '#2a1c06'], createGolem: ['#6a5a3a', '#16100a'], moonDragon: ['#3a4a8a', '#0a0e2a'], blizzard: ['#6aa8d8', '#0e2438'], thunderStorm: ['#3a3f70', '#0c0e24'], stormEagle: ['#5a8acf', '#162a4a'], troll: ['#6a7a4a', '#1a2210'], wandFine: ['#4a3a8a', '#120c2a'], blackWolf: ['#4a4f5a', '#12151c'], killerTiger: ['#b0742a', '#2a1a08'], bloodSnake: ['#6a2a5a', '#1c0a18'],
  greatMonkey: ['#6a8a3a', '#18240c'], vampire: ['#4a2a3a', '#120a10'], cockatrice: ['#7a7a4a', '#1e1e10'], signpost: ['#6a8a9a', '#1a2a34'], fireball: ['#a03a1a', '#2a0c06'], sandWall: ['#c9a46a', '#4a3a1c'],
  freezeWind: ['#5a9acf', '#122a44'], shiftForm: ['#5a3a9a', '#150c30'], teleport: ['#2a4a7a', '#0c1630'], reinforce: ['#8a7a4a', '#2a220e'], magicGuard: ['#3a5a9a', '#0e1a34'], chaosHand: ['#4a1a6a', '#120620'],
  aquaReturn: ['#2a6a9a', '#0a1e34'], goldenBody: ['#b08a2a', '#3a2808'], instinct: ['#8a5a2a', '#241406'], windSlash: ['#2a7a5a', '#0a2418'], redDragonBreath: ['#b02a0a', '#2a0804'], spark: ['#7a6a1a', '#1c1804'], swordFine: ['#6a7a8a', '#1a222a'], shieldFine: ['#5a6a7a', '#141c24'],
  stoneThrow: ['#7a7a6a', '#22221c'], staminaPotion: ['#3a7a4a', '#0e2414'], magicPotion: ['#3a4a9a', '#0e1234'], hyperPotion: ['#8a3a7a', '#260c20'], gobFlute: ['#5a7a3a', '#16200c'],
  thornTrap: ['#7a6a5a', '#1c1610'], magicSanctuary: ['#4a6aa8', '#0e1830'], petrifyRay: ['#8a8a6a', '#1c1c14'], elixir: ['#4aa07a', '#0c241c'], ferocious: ['#8a5a1a', '#241406'], gobParade: ['#4a6a2a', '#121c08'], assault: ['#8a2a2a', '#240808'], fightSpirit: ['#7a2a1a', '#200a06'],
};
/* 画像イラスト：CSSの背景画像として1回だけ登録して使い回す（blobやimgを使わず、再描画でも安定） */
(function () { try { if (typeof ART_IMG_B64 === 'undefined' || typeof document === 'undefined') return; const s = document.createElement('style'); s.textContent = Object.keys(ART_IMG_B64).map(k => `.ai-${k}{background-image:url(${ART_IMG_B64[k]})}`).join('\n'); document.head.appendChild(s); } catch (e) { } })();
/* 画像の表示位置（縦, %）。既定22。大きいほど絵の下側が見える */
const ART_POS = { blackWolf: 40, vampire: 10, petrifyRay: 40, magicGuard: 40, redDragonBreath: 16, normalGob: 34, greatMonkey: 18, shieldFine: 58, golem3: 26, thornTrap: 62, troll: 21, shiftForm: 26, magicSanctuary: 37, assault: 40, gobParade: 35, blizzard: 33, darkAssassin: 24, avatar: 22, magicPotion: 45, bowFine: 40 };
const artImgUrl = id => (typeof ART_IMG_B64 !== 'undefined' && ART_IMG_B64[id]) ? id : null;
function artSVG(id) {
  const iu = artImgUrl(id);
  if (iu) return `<div class="artimg ai-${iu}"></div>`;
  const a = ART[id] || ['#334', '#112'];
  const m = MOT[id] ? MOT[id]() : '';
  return `<svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g_${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a[0]}"/><stop offset="1" stop-color="${a[1]}"/></linearGradient></defs><rect width="200" height="120" fill="url(#g_${id})"/><path d="M0 92 L36 62 L66 82 L108 52 L150 80 L200 58 L200 120 L0 120Z" fill="rgba(0,0,0,.22)"/><rect y="104" width="200" height="16" fill="rgba(0,0,0,.35)"/>${m}</svg>`;
}
