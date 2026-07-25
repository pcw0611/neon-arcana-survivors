(function (global) {
  'use strict';

  const STORAGE_KEY = 'neon-arcana-language';
  const SUPPORTED = Object.freeze(['ko', 'zh', 'ja', 'en']);

  const messages = {
    ko: {
      'language.name': '한국어',
      'language.ko': '한국어',
      'language.zh': '中文',
      'language.ja': '日本語',
      'language.en': 'English',
      'common.on': '켜짐',
      'common.off': '꺼짐',
      'common.close': '닫기',
      'common.back': '뒤로',
      'common.cancel': '취소',
      'common.confirm': '확인',
      'common.continue': '계속',
      'common.retry': '다시 출격',
      'common.mainMenu': '메인 화면',
      'common.details': '상세',
      'common.loading': '불러오는 중…',
      'common.none': '없음',
      'common.unknown': '알 수 없음',
      'common.level': '레벨',
      'common.maxLevel': 'MAX LV',
      'common.limitBreak': '한계돌파',
      'common.seconds': '{count}초',
      'common.defeated': '{count} 격파',
      'term.technique': '술식',
      'term.techniques': '술식',
      'term.relic': '유물',
      'term.boss': '보스',
      'term.midBoss': '중간 보스',
      'term.enemy': '적',
      'term.projectile': '투사체',
      'term.saber': '광검',
      'term.orbit': '위성체',
      'term.damage': '피해',
      'term.attackSpeed': '공격 속도',
      'term.moveSpeed': '이동 속도',
      'term.range': '범위',
      'term.health': '체력',
      'term.experience': '경험치',
      'term.critical': '치명타',
      'term.cooldown': '재사용 대기시간',
      'term.survival': '생존',
      'term.kills': '격파 수',
      'term.score': '점수',
      'menu.open': '메뉴',
      'menu.title': '작전 메뉴',
      'menu.resume': '계속하기',
      'menu.quit': '작전 포기',
      'menu.quitConfirmTitle': '작전을 포기할까요?',
      'menu.quitConfirmBody': '현재 기록으로 작전을 종료하고 점수를 랭킹에 등록합니다.',
      'menu.quitConfirm': '포기하고 결과 보기',
      'menu.sound': '사운드',
      'menu.music': '배경음악',
      'menu.effects': '효과음',
      'menu.language': '언어',
      'menu.settings': '설정',
      'menu.hitbox': '플레이어 히트박스 표시',
      'menu.hitboxHint': '플레이어의 실제 피격 판정 범위를 화면에 표시합니다.',
      'start.subtitle': '도시 괴이 / 끝없는 균열',
      'start.description': '끝없이 증폭되는 도시 균열. 빌드와 유물을 완성하고 쓰러지는 순간까지 살아남아라.',
      'start.play': '무한 균열 진입 ›',
      'start.controls': 'WASD / 방향키 / 화면 드래그 · 마우스 조준 광검 · 자동 공격 · M 음소거',
      'hud.codex': '도감',
      'hud.relics': '유물 장착',
      'hud.radar': '균열 레이더',
      'hud.bossLimit': '제한 {time}',
      'hud.hp': '체력 {current}/{max}',
      'hud.level': 'LV.{level}',
      'hud.kills': '✦ {count}',
      'levelUp.tag': '아르카나 각성',
      'levelUp.title': '술식 공명 선택',
      'levelUp.subtitle': '이번 작전의 빌드를 결정하세요',
      'levelUp.currentLevel': 'LV.{level}',
      'levelUp.nextLevel': 'LV.{level} → LV.{next}',
      'levelUp.masteryReady': '특수 효과 개방',
      'levelUp.mastered': '술식 완성',
      'levelUp.limitLevel': '한계돌파 LV.{level}',
      'technique.projectile': '성좌탄 술식',
      'technique.saber': '아스트랄 광검 술식',
      'technique.orbit': '수호 위성체 술식',
      'technique.orbitDefense': '궤도 요격 술식',
      'technique.orbitDefenseDesc': '위성체에 닿은 적 미사일을 {chance}% 확률로 소거합니다.',
      'technique.pulse': '맥동 성환',
      'technique.pulseDesc': '모든 위성체가 주기적으로 충격파를 방출합니다. 현재 간격: {seconds}초',
      'technique.masterProjectile': '화면을 가르는 강력한 관통 레이저를 발사합니다.',
      'technique.masterSaber': '주기적으로 전방위를 베는 황금 선회참을 발동합니다.',
      'technique.masterOrbit': '위성체가 적을 추격해 폭발한 뒤 복귀합니다.',
      'mastery.limitBreakCycle': '한계돌파 레벨마다 특수기 공격 주기 -1%p (LV.20에서 -20% 상한)',
      'relic.tag': '잭팟 유물 캐시',
      'relic.resonance': '유물 공명',
      'relic.bossCache': '보스 유물 슬롯',
      'relic.jackpotCache': '잭팟 유물 슬롯',
      'relic.acquired': '새 유물 획득!',
      'relic.levelUp': '유물 레벨 업!',
      'relic.level': 'LV.{level}',
      'relic.duplicate': '중복 유물 · LV.{level}로 강화',
      'relic.autoPick': '획득 유물이 자동으로 결정됩니다.',
      'relic.fullAutoLevel': '슬롯이 가득 찼습니다. 중복 유물은 자동으로 레벨업합니다.',
      'relic.noRelics': '장착 유물 없음',
      'relic.huntHint': '보스와 잭팟 그렘린을 사냥하세요.',
      'relic.emptySlot': '빈 유물 슬롯',
      'relic.drop': '유물 드롭',
      'relic.noDrop': '유물 없음',
      'rarity.common': '일반',
      'rarity.rare': '레어',
      'rarity.unique': '유니크',
      'rarity.legendary': '전설',
      'rarity.mythic': '신화',
      'codex.title': 'NEON ARCANA 도감',
      'codex.techniques': '술식',
      'codex.relics': '유물',
      'codex.classes': '전직',
      'codex.locked': '미발견',
      'codex.masterEffect': '완성 특수 효과',
      'codex.limitBreak': '완성 후 한계돌파 가능',
      'ranking.global': '글로벌 균열 랭킹 · TOP 100',
      'ranking.yourRank': '내 순위 / TOP 100',
      'ranking.nickname': '닉네임 (2~12자)',
      'ranking.loading': '랭킹 불러오는 중…',
      'ranking.connecting': '온라인 랭킹 연결 대기 중',
      'ranking.submitting': '점수 등록 중…',
      'ranking.submitFailed': '점수 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      'ranking.ownRank': '이번 기록 순위: #{rank}',
      'ranking.scoreFormulaLabel': '점수 공식',
      'ranking.scoreFormula': '처치×10 + 레벨×120 + 생존초×4 + 보스×1,000 + 첫 보스 처치 2,500',
      'ranking.loadoutTitle': '{player} · 종료 시 빌드',
      'ranking.result': '결과',
      'ranking.survival': '생존',
      'ranking.levelKills': '레벨 / 격파',
      'ranking.bossRecord': '보스',
      'ranking.class': '전직',
      'ranking.noClass': '미상',
      'ranking.bosses': '{wins} 격파 · {fails} 실패',
      'ranking.techniqueEffects': '종료 시 술식·효과',
      'ranking.relics': '획득 유물',
      'ranking.noTechnique': '술식 정보 없음',
      'ranking.noTechniqueDesc': '저장된 강화 효과가 없습니다.',
      'ranking.noRelic': '획득 유물 없음',
      'ranking.noRelicDesc': '이 기록에는 저장된 유물이 없습니다.',
      'ranking.legacy': '이전 버전 기록이라 상세 빌드 정보가 없습니다.',
      'boss.warning': '경고',
      'boss.detected': '보스 이상 신호 감지',
      'boss.incoming': '보스 접근 중',
      'boss.finalIncoming': '최종 균열 군주 접근',
      'boss.timeLeft': '보스 제한 · {seconds}초',
      'boss.deadlineMissed': '보스 신호 소실',
      'boss.defeated': '보스 #{number} 격파',
      'boss.relicDrop': '보스 #{number} 격파 · 유물 드롭',
      'boss.noRelicDrop': '보스 #{number} 격파 · 유물 없음',
      'boss.pattern.barrage': '탄막 전개',
      'boss.pattern.dash': '돌진 경로 감지',
      'boss.pattern.ring': '환형 포격',
      'boss.pattern.laser': '고출력 레이저 조준',
      'boss.pattern.summon': '증원 소환',
      'enemy.jackpot': '잭팟 신호 // 유물 운반체',
      'enemy.bomber': '폭주 자폭체',
      'enemy.bomberArmed': '자폭체 기폭 준비',
      'gameOver.tag': '균열 붕괴',
      'gameOver.title': '작전 종료',
      'gameOver.abandoned': '작전 포기',
      'gameOver.resultRegistered': '현재 기록이 랭킹에 등록됩니다.',
      'gameOver.time': '생존 시간',
      'gameOver.kills': '격파 수',
      'gameOver.bosses': '보스 격파',
      'gameOver.level': '도달 레벨',
      'gameOver.missionFailed': '작전 실패',
      'gameOver.riftSealed': '균열 봉인 완료',
    },

    zh: {
      'language.name': '中文', 'language.ko': '한국어', 'language.zh': '中文', 'language.ja': '日本語', 'language.en': 'English',
      'common.on': '开启', 'common.off': '关闭', 'common.close': '关闭', 'common.back': '返回', 'common.cancel': '取消', 'common.confirm': '确认', 'common.continue': '继续', 'common.retry': '再次出击', 'common.mainMenu': '主界面', 'common.details': '详情', 'common.loading': '加载中…', 'common.none': '无', 'common.unknown': '未知', 'common.level': '等级', 'common.maxLevel': 'MAX LV', 'common.limitBreak': '极限突破', 'common.seconds': '{count}秒', 'common.defeated': '击破 {count}',
      'term.technique': '术式', 'term.techniques': '术式', 'term.relic': '遗物', 'term.boss': '首领', 'term.midBoss': '中型首领', 'term.enemy': '敌人', 'term.projectile': '投射物', 'term.saber': '光剑', 'term.orbit': '卫星体', 'term.damage': '伤害', 'term.attackSpeed': '攻击速度', 'term.moveSpeed': '移动速度', 'term.range': '范围', 'term.health': '生命值', 'term.experience': '经验值', 'term.critical': '暴击', 'term.cooldown': '冷却时间', 'term.survival': '生存', 'term.kills': '击破数', 'term.score': '分数',
      'menu.open': '菜单', 'menu.title': '作战菜单', 'menu.resume': '继续游戏', 'menu.quit': '放弃作战', 'menu.quitConfirmTitle': '要放弃本次作战吗？', 'menu.quitConfirmBody': '将以当前记录结束作战，并把分数上传至排行榜。', 'menu.quitConfirm': '放弃并查看结果', 'menu.sound': '声音', 'menu.music': '背景音乐', 'menu.effects': '音效', 'menu.language': '语言', 'menu.settings': '设置', 'menu.hitbox': '显示玩家碰撞范围', 'menu.hitboxHint': '在画面上显示玩家实际受到攻击判定的范围。',
      'start.subtitle': '都市怪异 / 无尽裂隙', 'start.description': '都市裂隙正无尽增幅。完成构筑与遗物组合，坚持到倒下的最后一刻。', 'start.play': '进入无尽裂隙 ›', 'start.controls': 'WASD / 方向键 / 拖动屏幕 · 鼠标瞄准光剑 · 自动攻击 · M 静音',
      'hud.codex': '图鉴', 'hud.relics': '遗物装备', 'hud.radar': '裂隙雷达', 'hud.bossLimit': '限制 {time}', 'hud.hp': '生命 {current}/{max}', 'hud.level': 'LV.{level}', 'hud.kills': '✦ {count}',
      'levelUp.tag': '奥术觉醒', 'levelUp.title': '选择术式共鸣', 'levelUp.subtitle': '决定本次行动的构筑', 'levelUp.currentLevel': 'LV.{level}', 'levelUp.nextLevel': 'LV.{level} → LV.{next}', 'levelUp.masteryReady': '解锁特殊效果', 'levelUp.mastered': '术式完成', 'levelUp.limitLevel': '极限突破 LV.{level}',
      'technique.projectile': '星座弹术式', 'technique.saber': '星界光剑术式', 'technique.orbit': '守护卫星体术式', 'technique.orbitDefense': '轨道拦截术式', 'technique.orbitDefenseDesc': '敌方导弹接触卫星体时，有 {chance}% 概率将其消除。', 'technique.pulse': '脉动星环', 'technique.pulseDesc': '所有卫星体周期性释放冲击波。当前间隔：{seconds}秒', 'technique.masterProjectile': '发射贯穿屏幕的高威力激光。', 'technique.masterSaber': '周期性发动横扫全方位的黄金旋斩。', 'technique.masterOrbit': '卫星体追踪敌人并爆炸，随后返回。', 'mastery.limitBreakCycle': '每级极限突破使特殊攻击间隔 -1%p（LV.20 时上限 -20%）',
      'relic.tag': '大奖遗物缓存', 'relic.resonance': '遗物共鸣', 'relic.bossCache': '首领遗物槽', 'relic.jackpotCache': '大奖遗物槽', 'relic.acquired': '获得新遗物！', 'relic.levelUp': '遗物升级！', 'relic.level': 'LV.{level}', 'relic.duplicate': '重复遗物 · 强化至 LV.{level}', 'relic.autoPick': '将自动决定获得的遗物。', 'relic.fullAutoLevel': '栏位已满。重复遗物将自动升级。', 'relic.noRelics': '未装备遗物', 'relic.huntHint': '猎杀首领和大奖哥布林。', 'relic.emptySlot': '空遗物栏位', 'relic.drop': '遗物掉落', 'relic.noDrop': '没有遗物',
      'rarity.common': '普通', 'rarity.rare': '稀有', 'rarity.unique': '独特', 'rarity.legendary': '传说', 'rarity.mythic': '神话',
      'codex.title': 'NEON ARCANA 图鉴', 'codex.techniques': '术式', 'codex.relics': '遗物', 'codex.classes': '转职', 'codex.locked': '未发现', 'codex.masterEffect': '完成特殊效果', 'codex.limitBreak': '完成后可进行极限突破',
      'ranking.global': '全球裂隙排行榜 · TOP 100', 'ranking.yourRank': '我的排名 / TOP 100', 'ranking.nickname': '昵称（2～12字）', 'ranking.loading': '正在加载排行榜…', 'ranking.connecting': '正在连接在线排行榜', 'ranking.submitting': '正在上传分数…', 'ranking.submitFailed': '分数保存失败，请稍后重试。', 'ranking.ownRank': '本次记录排名：#{rank}', 'ranking.scoreFormulaLabel': '计分公式', 'ranking.scoreFormula': '击破×10 + 等级×120 + 生存秒数×4 + 首领×1,000 + 首次击破首领 2,500', 'ranking.loadoutTitle': '{player} · 结束时构筑', 'ranking.result': '结果', 'ranking.survival': '生存', 'ranking.levelKills': '等级 / 击破', 'ranking.bossRecord': '首领', 'ranking.bosses': '击破 {wins} · 失败 {fails}', 'ranking.techniqueEffects': '结束时术式与效果', 'ranking.relics': '获得的遗物', 'ranking.noTechnique': '无术式信息', 'ranking.noTechniqueDesc': '没有保存的强化效果。', 'ranking.noRelic': '未获得遗物', 'ranking.noRelicDesc': '该记录中没有保存的遗物。', 'ranking.legacy': '这是旧版本记录，因此没有详细构筑信息。',
      'boss.warning': '警告', 'boss.detected': '检测到首领异常信号', 'boss.incoming': '首领正在接近', 'boss.finalIncoming': '最终裂隙领主正在接近', 'boss.timeLeft': '首领时限 · {seconds}秒', 'boss.deadlineMissed': '首领信号丢失', 'boss.defeated': '击破首领 #{number}', 'boss.relicDrop': '击破首领 #{number} · 遗物掉落', 'boss.noRelicDrop': '击破首领 #{number} · 没有遗物', 'boss.pattern.barrage': '弹幕展开', 'boss.pattern.dash': '检测到冲刺轨迹', 'boss.pattern.ring': '环形炮击', 'boss.pattern.laser': '高功率激光瞄准', 'boss.pattern.summon': '召唤增援',
      'enemy.jackpot': '大奖信号 // 遗物携带者', 'enemy.bomber': '暴走自爆体', 'enemy.bomberArmed': '自爆体引爆准备',
      'gameOver.tag': '裂隙崩溃', 'gameOver.title': '作战结束', 'gameOver.abandoned': '已放弃作战', 'gameOver.resultRegistered': '当前记录将上传至排行榜。', 'gameOver.time': '生存时间', 'gameOver.kills': '击破数', 'gameOver.bosses': '首领击破', 'gameOver.level': '到达等级', 'gameOver.missionFailed': '作战失败', 'gameOver.riftSealed': '裂隙封印完成',
    },

    ja: {
      'language.name': '日本語', 'language.ko': '한국어', 'language.zh': '中文', 'language.ja': '日本語', 'language.en': 'English',
      'common.on': 'オン', 'common.off': 'オフ', 'common.close': '閉じる', 'common.back': '戻る', 'common.cancel': 'キャンセル', 'common.confirm': '確認', 'common.continue': '続ける', 'common.retry': '再出撃', 'common.mainMenu': 'メイン画面', 'common.details': '詳細', 'common.loading': '読み込み中…', 'common.none': 'なし', 'common.unknown': '不明', 'common.level': 'レベル', 'common.maxLevel': 'MAX LV', 'common.limitBreak': '限界突破', 'common.seconds': '{count}秒', 'common.defeated': '{count}体撃破',
      'term.technique': '術式', 'term.techniques': '術式', 'term.relic': '遺物', 'term.boss': 'ボス', 'term.midBoss': '中ボス', 'term.enemy': '敵', 'term.projectile': '投射体', 'term.saber': '光剣', 'term.orbit': '衛星体', 'term.damage': 'ダメージ', 'term.attackSpeed': '攻撃速度', 'term.moveSpeed': '移動速度', 'term.range': '範囲', 'term.health': 'HP', 'term.experience': '経験値', 'term.critical': 'クリティカル', 'term.cooldown': 'クールタイム', 'term.survival': '生存', 'term.kills': '撃破数', 'term.score': 'スコア',
      'menu.open': 'メニュー', 'menu.title': '作戦メニュー', 'menu.resume': 'ゲームに戻る', 'menu.quit': '作戦を放棄', 'menu.quitConfirmTitle': '作戦を放棄しますか？', 'menu.quitConfirmBody': '現在の記録で作戦を終了し、スコアをランキングに登録します。', 'menu.quitConfirm': '放棄して結果を見る', 'menu.sound': 'サウンド', 'menu.music': 'BGM', 'menu.effects': '効果音', 'menu.language': '言語', 'menu.settings': '設定', 'menu.hitbox': 'プレイヤー当たり判定を表示', 'menu.hitboxHint': 'プレイヤーが実際に被弾する判定範囲を画面に表示します。',
      'start.subtitle': '都市怪異 / 終わりなき亀裂', 'start.description': '増幅し続ける都市の亀裂。ビルドと遺物を完成させ、倒れる瞬間まで生き残れ。', 'start.play': '無限亀裂へ ›', 'start.controls': 'WASD / 方向キー / 画面ドラッグ · マウスで光剣照準 · 自動攻撃 · M ミュート',
      'hud.codex': '図鑑', 'hud.relics': '遺物装備', 'hud.radar': '亀裂レーダー', 'hud.bossLimit': '制限 {time}', 'hud.hp': 'HP {current}/{max}', 'hud.level': 'LV.{level}', 'hud.kills': '✦ {count}',
      'levelUp.tag': 'アルカナ覚醒', 'levelUp.title': '術式共鳴を選択', 'levelUp.subtitle': '今回の作戦のビルドを決めてください', 'levelUp.currentLevel': 'LV.{level}', 'levelUp.nextLevel': 'LV.{level} → LV.{next}', 'levelUp.masteryReady': '特殊効果解放', 'levelUp.mastered': '術式完成', 'levelUp.limitLevel': '限界突破 LV.{level}',
      'technique.projectile': '星座弾術式', 'technique.saber': 'アストラル光剣術式', 'technique.orbit': '守護衛星体術式', 'technique.orbitDefense': '軌道迎撃術式', 'technique.orbitDefenseDesc': '衛星体に触れた敵ミサイルを {chance}% の確率で消去します。', 'technique.pulse': '脈動星環', 'technique.pulseDesc': '全衛星体が周期的に衝撃波を放ちます。現在の間隔：{seconds}秒', 'technique.masterProjectile': '画面を貫く高威力レーザーを発射します。', 'technique.masterSaber': '周期的に全方向を薙ぐ黄金旋回斬りを発動します。', 'technique.masterOrbit': '衛星体が敵を追跡して爆発し、その後帰還します。', 'mastery.limitBreakCycle': '限界突破LVごとに特殊攻撃間隔 -1%p（LV.20で-20%上限）',
      'relic.tag': 'ジャックポット遺物キャッシュ', 'relic.resonance': '遺物共鳴', 'relic.bossCache': 'ボス遺物スロット', 'relic.jackpotCache': 'ジャックポット遺物スロット', 'relic.acquired': '新しい遺物を獲得！', 'relic.levelUp': '遺物レベルアップ！', 'relic.level': 'LV.{level}', 'relic.duplicate': '重複遺物 · LV.{level}に強化', 'relic.autoPick': '獲得する遺物は自動で決まります。', 'relic.fullAutoLevel': 'スロットが満杯です。重複遺物は自動でレベルアップします。', 'relic.noRelics': '装備中の遺物なし', 'relic.huntHint': 'ボスとジャックポットグレムリンを狩りましょう。', 'relic.emptySlot': '空の遺物スロット', 'relic.drop': '遺物ドロップ', 'relic.noDrop': '遺物なし',
      'rarity.common': 'ノーマル', 'rarity.rare': 'レア', 'rarity.unique': 'ユニーク', 'rarity.legendary': '伝説', 'rarity.mythic': '神話',
      'codex.title': 'NEON ARCANA 図鑑', 'codex.techniques': '術式', 'codex.relics': '遺物', 'codex.classes': '転職', 'codex.locked': '未発見', 'codex.masterEffect': '完成時の特殊効果', 'codex.limitBreak': '完成後に限界突破可能',
      'ranking.global': 'グローバル亀裂ランキング · TOP 100', 'ranking.yourRank': '自分の順位 / TOP 100', 'ranking.nickname': 'ニックネーム（2～12文字）', 'ranking.loading': 'ランキング読み込み中…', 'ranking.connecting': 'オンラインランキングに接続中', 'ranking.submitting': 'スコア登録中…', 'ranking.submitFailed': 'スコアを保存できませんでした。しばらくしてから再試行してください。', 'ranking.ownRank': '今回の記録：#{rank}位', 'ranking.scoreFormulaLabel': 'スコア計算式', 'ranking.scoreFormula': '撃破×10 + レベル×120 + 生存秒×4 + ボス×1,000 + 初回ボス撃破 2,500', 'ranking.loadoutTitle': '{player} · 終了時のビルド', 'ranking.result': '結果', 'ranking.survival': '生存', 'ranking.levelKills': 'レベル / 撃破', 'ranking.bossRecord': 'ボス', 'ranking.bosses': '{wins}体撃破 · {fails}回失敗', 'ranking.techniqueEffects': '終了時の術式・効果', 'ranking.relics': '獲得遺物', 'ranking.noTechnique': '術式情報なし', 'ranking.noTechniqueDesc': '保存された強化効果がありません。', 'ranking.noRelic': '獲得遺物なし', 'ranking.noRelicDesc': 'この記録には遺物が保存されていません。', 'ranking.legacy': '旧バージョンの記録のため、詳細なビルド情報がありません。',
      'boss.warning': '警告', 'boss.detected': 'ボス異常信号を検知', 'boss.incoming': 'ボス接近中', 'boss.finalIncoming': '最終亀裂の主が接近中', 'boss.timeLeft': 'ボス制限 · 残り{seconds}秒', 'boss.deadlineMissed': 'ボス信号ロスト', 'boss.defeated': 'ボス #{number} 撃破', 'boss.relicDrop': 'ボス #{number} 撃破 · 遺物ドロップ', 'boss.noRelicDrop': 'ボス #{number} 撃破 · 遺物なし', 'boss.pattern.barrage': '弾幕展開', 'boss.pattern.dash': '突進経路を検知', 'boss.pattern.ring': '環状砲撃', 'boss.pattern.laser': '高出力レーザー照準', 'boss.pattern.summon': '増援召喚',
      'enemy.jackpot': 'ジャックポット信号 // 遺物運搬体', 'enemy.bomber': '暴走自爆体', 'enemy.bomberArmed': '自爆体が起爆準備',
      'gameOver.tag': '亀裂崩壊', 'gameOver.title': '作戦終了', 'gameOver.abandoned': '作戦放棄', 'gameOver.resultRegistered': '現在の記録をランキングに登録します。', 'gameOver.time': '生存時間', 'gameOver.kills': '撃破数', 'gameOver.bosses': 'ボス撃破', 'gameOver.level': '到達レベル', 'gameOver.missionFailed': '作戦失敗', 'gameOver.riftSealed': '亀裂封印完了',
    },

    en: {
      'language.name': 'English', 'language.ko': '한국어', 'language.zh': '中文', 'language.ja': '日本語', 'language.en': 'English',
      'common.on': 'On', 'common.off': 'Off', 'common.close': 'Close', 'common.back': 'Back', 'common.cancel': 'Cancel', 'common.confirm': 'Confirm', 'common.continue': 'Continue', 'common.retry': 'Deploy Again', 'common.mainMenu': 'Main Menu', 'common.details': 'Details', 'common.loading': 'Loading…', 'common.none': 'None', 'common.unknown': 'Unknown', 'common.level': 'Level', 'common.maxLevel': 'MAX LV', 'common.limitBreak': 'Limit Break', 'common.seconds': '{count}s', 'common.defeated': '{count} defeated',
      'term.technique': 'Technique', 'term.techniques': 'Techniques', 'term.relic': 'Relic', 'term.boss': 'Boss', 'term.midBoss': 'Mid-Boss', 'term.enemy': 'Enemy', 'term.projectile': 'Projectile', 'term.saber': 'Light Saber', 'term.orbit': 'Orbital', 'term.damage': 'Damage', 'term.attackSpeed': 'Attack Speed', 'term.moveSpeed': 'Move Speed', 'term.range': 'Range', 'term.health': 'HP', 'term.experience': 'EXP', 'term.critical': 'Critical', 'term.cooldown': 'Cooldown', 'term.survival': 'Survival', 'term.kills': 'Kills', 'term.score': 'Score',
      'menu.open': 'Menu', 'menu.title': 'Operation Menu', 'menu.resume': 'Resume', 'menu.quit': 'Abandon Operation', 'menu.quitConfirmTitle': 'Abandon this operation?', 'menu.quitConfirmBody': 'The operation will end with your current record, and the score will be submitted to the leaderboard.', 'menu.quitConfirm': 'Abandon and View Results', 'menu.sound': 'Sound', 'menu.music': 'Music', 'menu.effects': 'Sound Effects', 'menu.language': 'Language', 'menu.settings': 'Settings', 'menu.hitbox': 'Show Player Hitbox', 'menu.hitboxHint': "Shows the player's actual damage collision area on screen.",
      'start.subtitle': 'URBAN OCCULT / ENDLESS RIFT', 'start.description': 'An urban rift grows without end. Complete your build and relics, then survive until the moment you fall.', 'start.play': 'ENTER ENDLESS RIFT ›', 'start.controls': 'WASD / Arrow Keys / Drag · Aim saber with mouse · Auto Attack · M Mute',
      'hud.codex': 'CODEX', 'hud.relics': 'RELIC LOADOUT', 'hud.radar': 'RIFT RADAR', 'hud.bossLimit': 'LIMIT {time}', 'hud.hp': 'HP {current}/{max}', 'hud.level': 'LV.{level}', 'hud.kills': '✦ {count}',
      'levelUp.tag': 'ARCANA AWAKENING', 'levelUp.title': 'Select a Technique Resonance', 'levelUp.subtitle': 'Shape the build for this operation', 'levelUp.currentLevel': 'LV.{level}', 'levelUp.nextLevel': 'LV.{level} → LV.{next}', 'levelUp.masteryReady': 'Special Effect Unlocked', 'levelUp.mastered': 'Technique Complete', 'levelUp.limitLevel': 'Limit Break LV.{level}',
      'technique.projectile': 'Constellation Shot Technique', 'technique.saber': 'Astral Saber Technique', 'technique.orbit': 'Guardian Orbital Technique', 'technique.orbitDefense': 'Orbital Interception Technique', 'technique.orbitDefenseDesc': 'Enemy missiles touching an orbital are destroyed with a {chance}% chance.', 'technique.pulse': 'Pulsing Star Ring', 'technique.pulseDesc': 'All orbitals periodically emit a shockwave. Current interval: {seconds}s', 'technique.masterProjectile': 'Fires a high-powered piercing laser across the screen.', 'technique.masterSaber': 'Periodically unleashes a golden whirlwind slash in every direction.', 'technique.masterOrbit': 'Orbitals chase enemies, explode, and then return.', 'mastery.limitBreakCycle': 'Special attack interval -1%p per Limit Break level (capped at -20% at LV.20)',
      'relic.tag': 'JACKPOT RELIC CACHE', 'relic.resonance': 'Relic Resonance', 'relic.bossCache': 'Boss Relic Slot', 'relic.jackpotCache': 'Jackpot Relic Slot', 'relic.acquired': 'New Relic Acquired!', 'relic.levelUp': 'Relic Level Up!', 'relic.level': 'LV.{level}', 'relic.duplicate': 'Duplicate Relic · Enhanced to LV.{level}', 'relic.autoPick': 'Your relic will be chosen automatically.', 'relic.fullAutoLevel': 'All slots are full. Duplicate relics level up automatically.', 'relic.noRelics': 'No Relics Equipped', 'relic.huntHint': 'Hunt bosses and Jackpot Gremlins.', 'relic.emptySlot': 'Empty Relic Slot', 'relic.drop': 'Relic Drop', 'relic.noDrop': 'No Relic',
      'rarity.common': 'Common', 'rarity.rare': 'Rare', 'rarity.unique': 'Unique', 'rarity.legendary': 'Legendary', 'rarity.mythic': 'Mythic',
      'codex.title': 'NEON ARCANA CODEX', 'codex.techniques': 'Techniques', 'codex.relics': 'Relics', 'codex.classes': 'Classes', 'codex.locked': 'Undiscovered', 'codex.masterEffect': 'Completion Special Effect', 'codex.limitBreak': 'Limit Break available after completion',
      'ranking.global': 'GLOBAL RIFT RANKING · TOP 100', 'ranking.yourRank': 'YOUR RANK / TOP 100', 'ranking.nickname': 'Nickname (2–12 characters)', 'ranking.loading': 'Loading leaderboard…', 'ranking.connecting': 'Connecting to online leaderboard', 'ranking.submitting': 'Submitting score…', 'ranking.submitFailed': 'Could not save your score. Please try again shortly.', 'ranking.ownRank': 'This run: #{rank}', 'ranking.scoreFormulaLabel': 'SCORE FORMULA', 'ranking.scoreFormula': 'Kills×10 + Level×120 + Survival Seconds×4 + Bosses×1,000 + First Boss Kill 2,500', 'ranking.loadoutTitle': '{player} · End Techniques', 'ranking.result': 'Result', 'ranking.survival': 'Survival', 'ranking.levelKills': 'Level / Kills', 'ranking.bossRecord': 'Bosses', 'ranking.bosses': '{wins} defeated · {fails} failed', 'ranking.techniqueEffects': 'End Techniques & Effects', 'ranking.relics': 'Relics Acquired', 'ranking.noTechnique': 'No Technique Data', 'ranking.noTechniqueDesc': 'No saved enhancements are available.', 'ranking.noRelic': 'No Relics Acquired', 'ranking.noRelicDesc': 'No relics were saved for this record.', 'ranking.legacy': 'Detailed technique data is unavailable for records from an older version.',
      'boss.warning': 'WARNING', 'boss.detected': 'BOSS ANOMALY DETECTED', 'boss.incoming': 'BOSS INCOMING', 'boss.finalIncoming': 'FINAL RIFT LORD INCOMING', 'boss.timeLeft': 'BOSS LIMIT · {seconds} SECONDS', 'boss.deadlineMissed': 'BOSS SIGNAL LOST', 'boss.defeated': 'BOSS #{number} DOWN', 'boss.relicDrop': 'BOSS #{number} DOWN · RELIC DROP', 'boss.noRelicDrop': 'BOSS #{number} DOWN · NO RELIC', 'boss.pattern.barrage': 'BARRAGE DEPLOYED', 'boss.pattern.dash': 'CHARGE PATH DETECTED', 'boss.pattern.ring': 'RING BARRAGE', 'boss.pattern.laser': 'HIGH-POWER LASER LOCK', 'boss.pattern.summon': 'REINFORCEMENTS SUMMONED',
      'enemy.jackpot': 'JACKPOT SIGNAL // RELIC CARRIER', 'enemy.bomber': 'RAMPAGE BOMBER', 'enemy.bomberArmed': 'BOMBER ARMED',
      'gameOver.tag': 'RIFT COLLAPSED', 'gameOver.title': 'OPERATION ENDED', 'gameOver.abandoned': 'OPERATION ABANDONED', 'gameOver.resultRegistered': 'Your current record will be submitted to the leaderboard.', 'gameOver.time': 'Survival Time', 'gameOver.kills': 'Kills', 'gameOver.bosses': 'Bosses Defeated', 'gameOver.level': 'Level Reached', 'gameOver.missionFailed': 'MISSION FAILED', 'gameOver.riftSealed': 'RIFT SEALED',
    },
  };

  // Content catalog keys intentionally mirror the stable gameplay IDs so UI code can
  // translate data-driven cards without maintaining a second ID mapping table.
  const catalogs = {
    ko: {
      upgrade: {
        power: ['룬 증폭', '모든 공격 피해량 +12%'],
        haste: ['영창 가속', '성좌탄 공격 간격 13% 감소'],
        multishot: ['쌍성 궤도', '동시에 발사하는 성좌탄 +1'],
        pierce: ['위상 관통', '성좌탄 관통 횟수 +1'],
        critical: ['운명 간섭', '치명타 확률 +8%, 치명 피해 배율 +0.18'],
        blast: ['붕괴 잔향', '성좌탄 명중 시 폭발 반경 +22/LV (최대 132) · 주변 적에게 주 대상 피해의 35%'],
        chain: ['연쇄 낙뢰', '성좌탄 명중 시 210 이내 낙뢰 대상 +1/LV (최대 5) · 각 대상에게 주 대상 피해의 28%'],
        size: ['거대 성핵', '성좌탄 크기 +18%, 피해 +10%'],
        orbit: ['수호 위성체', '공격 위성체 +1, 위성체 빌드 개방'],
        orbit_speed: ['초고속 공전', '위성체 회전 속도 +24%'],
        orbit_size: ['거대 위성핵', '위성체 크기 +20%, 피해 +16%'],
        orbit_range: ['이중 공전면', '공전 반경 +16, 위성체 피해 +10%'],
        orbit_shock: ['초신성 방전', '위성체 명중 시 방전 확률 +12%p/LV (최대 48%) · 반경 90 · 주변 적에게 주 대상 피해의 42%'],
        orbit_pulse: ['맥동 성환', '모든 위성체가 주기적으로 충격파 방출'],
        orbit_guard: ['궤도 요격', '위성체에 닿은 적 미사일을 일정 확률로 소거'],
        orbit_intercept: ['궤도 요격', '위성체에 닿은 적 미사일을 일정 확률로 소거'],
        saber: ['아스트랄 광검', '광검 피해 +25%'],
        saber_reach: ['월광 검로', '광검 사거리 +20, 베기 각도 확대'],
        saber_haste: ['찰나 발도', '광검 공격 간격 17% 감소'],
        saber_echo: ['잔상 연격', '광검 추가 잔상 베기 +1'],
        saber_guard: ['검막 반사', '광검 사용 중 방어 확률 +7%'],
        speed: ['공간 도약', '이동 속도 +11%'],
        magnet: ['중력 우물', '경험치 흡수 범위 +85'],
        vital: ['생명 결계', '최대 체력 +8, 체력 10 회복'],
        regen: ['재생 술식', '초당 체력 회복 +0.35'],
        guard: ['성좌 방벽', '피격 무효 확률 +6%'],
        fortune: ['마력 정제', '획득 경험치 +22%'],
        relic_slot: ['차원 수납 확장', '유물 슬롯 +1 (최대 7)'],
        limit_master_projectile: ['성좌포 한계돌파', '완성 레이저 피해 +4%p, 범위 +2%p, 공격 주기 -1%p/LV (주기 -20%·범위 LV.20 상한)'],
        limit_master_saber: ['광검 한계돌파', '완성 선회참 피해 +4%p, 범위 +2%p, 공격 주기 -1%p/LV (주기 -20%·범위 LV.20 상한)'],
        limit_master_orbit: ['위성체 한계돌파', '완성 추격 폭발 피해 +4%p, 범위 +2%p, 공격 주기 -1%p/LV (주기 -20%·범위 LV.20 상한)'],
        limit_power: ['한계돌파 · 힘', '모든 공격 피해량 +6%'],
        limit_vital: ['한계돌파 · 생명', '최대 체력 +5, 체력 5 회복'],
        limit_growth: ['한계돌파 · 공명', '경험치 +7%, 흡수 범위 +20'],
      },
      relic: {
        arc_cell: ['증폭 아크 셀', '모든 공격 피해 +15%'],
        blood_cap: ['혈류 축전지', '최대 체력 +12, 최초 획득 시 체력 12 회복'],
        magnet_prism: ['자력 프리즘', '흡수 범위 +30%, 경험치 +10%'],
        hunter_lens: ['사냥꾼의 렌즈', '치명타 확률 +8%, 치명 피해 +0.2'],
        split_core: ['분열 코어', '4번째 성좌탄 일제사격마다 투사체 +2'],
        orbit_gear: ['성환 가속기', '위성체 +1, 속도 +30%, 피해 +30%'],
        edge_lens: ['근접 초점 렌즈', '광검 피해 +45%, 사거리 +18'],
        nano_shunt: ['나노 회복 분기기', '재생 +0.45, 일반 적 20킬마다 체력 3 회복'],
        execution: ['처형 프로토콜', '일반 적 체력이 15% 미만이면 즉시 처형'],
        echo_chamber: ['공명 탄실', '6번째 일제사격이 70% 피해로 반복'],
        gravity_halo: ['중력 후광', '주변 일반 적 이동 속도 24% 감소'],
        soul_battery: ['영혼 배터리', '일반 적 12킬마다 체력 2 회복, 모든 피해 +12%'],
        event_horizon: ['사건의 지평선', '위성체 +2, 크기 +45%, 피해 +70%, 충격파 추가'],
        zero_edge: ['제로 엣지', '광검 피해 +80%, 속도 +33%, 잔상 베기 +1'],
        phoenix: ['불사조 커널', '1회 치명상을 무시하고 체력 40%로 부활'],
        rift_crown: ['균열 왕관', '모든 피해 +35%, 경험치 +25%'],
        singularity: ['아르카나 특이점', '모든 피해 +60%, 각 빌드 추가 피해 +25%'],
        immortal: ['불멸 회로', '최대 체력 +30, 재생 +1, 일반 적 8킬마다 체력 2 회복'],
        godspeed: ['신속 연산기관', '이동 +25%, 성좌탄·광검·위성체 속도 대폭 증가'],
        chain_detonator: ['연쇄 기폭 코어', '자폭 적 폭발 시 주변 적에게 피해 30% · 유물 레벨당 +15%p · 최대 120%'],
        tamer_core: ['조련의 코어', '보스 처치 시 12%p 확률로 아군화, 레벨당 +12%p, 최대 65%'],
      },
      mastery: {
        projectile: ['성좌탄 술식 완성', '주기적으로 화면을 가르는 강력한 관통 레이저를 발사'],
        saber: ['광검 술식 완성', '주기적으로 전방위를 베는 황금 선회참을 발동'],
        orbit: ['위성체 술식 완성', '위성체가 적을 추격해 폭발한 뒤 플레이어에게 복귀'],
      },
    },

    en: {
      upgrade: {
        power: ['Rune Amplification', 'All attack damage +12%'], haste: ['Cast Acceleration', 'Constellation Shot interval -13%'], multishot: ['Binary Orbit', 'Simultaneous Constellation Shots +1'], pierce: ['Phase Pierce', 'Projectile pierces +1'], critical: ['Fate Interference', 'Critical chance +8%, critical multiplier +0.18'], blast: ['Collapse Echo', 'On Constellation Shot hit: blast radius +22/LV (max 132) · nearby enemies take 35% of the primary hit'], chain: ['Chain Lightning', 'On Constellation Shot hit: lightning targets +1/LV within 210 (max 5) · each takes 28% of the primary hit'], size: ['Giant Star Core', 'Projectile size +18%, damage +10%'],
        orbit: ['Guardian Orbital', 'Attack orbital +1; unlocks the orbital build'], orbit_speed: ['Hyper Orbit', 'Orbital rotation speed +24%'], orbit_size: ['Giant Orbital Core', 'Orbital size +20%, damage +16%'], orbit_range: ['Dual Orbital Plane', 'Orbit radius +16, orbital damage +10%'], orbit_shock: ['Supernova Discharge', 'On orbital hit: discharge chance +12%p/LV (max 48%) · radius 90 · nearby enemies take 42% of the primary hit'], orbit_pulse: ['Pulsing Star Ring', 'All orbitals periodically emit a shockwave'], orbit_guard: ['Orbital Interception', 'Orbitals have a chance to destroy enemy missiles they touch'], orbit_intercept: ['Orbital Interception', 'Orbitals have a chance to destroy enemy missiles they touch'],
        saber: ['Astral Saber', 'Saber damage +25%'], saber_reach: ['Moonlit Sword Path', 'Saber reach +20 and wider slash arc'], saber_haste: ['Flash Draw', 'Saber attack interval -17%'], saber_echo: ['Afterimage Combo', 'Additional saber afterimage slash +1'], saber_guard: ['Blade Veil Reflection', 'Defense chance while slashing +7%'], speed: ['Spatial Leap', 'Move speed +11%'], magnet: ['Gravity Well', 'EXP pickup radius +85'], vital: ['Life Barrier', 'Max HP +8 and recover 10 HP'], regen: ['Regeneration Technique', 'HP regeneration +0.35 per second'], guard: ['Constellation Barrier', 'Hit-negation chance +6%'], fortune: ['Arcane Refinement', 'EXP gained +22%'], relic_slot: ['Dimensional Storage', 'Relic slot +1 (maximum 7)'],
        limit_master_projectile: ['Star Cannon Limit Break', 'Completion laser damage +4%p, area +2%p, attack interval -1%p/LV (interval -20% and area capped at LV.20)'], limit_master_saber: ['Saber Limit Break', 'Completion whirlwind damage +4%p, area +2%p, attack interval -1%p/LV (interval -20% and area capped at LV.20)'], limit_master_orbit: ['Orbital Limit Break', 'Completion chase explosion damage +4%p, area +2%p, attack interval -1%p/LV (interval -20% and area capped at LV.20)'], limit_power: ['Limit Break · Power', 'All attack damage +6%'], limit_vital: ['Limit Break · Life', 'Max HP +5 and recover 5 HP'], limit_growth: ['Limit Break · Resonance', 'EXP +7%, pickup radius +20'],
      },
      relic: {
        arc_cell: ['Amplified Arc Cell', 'All attack damage +15%'], blood_cap: ['Bloodflow Capacitor', 'Max HP +12; recover 12 HP when first acquired'], magnet_prism: ['Magnetic Prism', 'Pickup radius +30%, EXP +10%'], hunter_lens: ["Hunter's Lens", 'Critical chance +8%, critical damage +0.2'], split_core: ['Fission Core', '+2 projectiles every fourth Constellation Shot volley'], orbit_gear: ['Star-Ring Accelerator', 'Orbital +1, speed +30%, damage +30%'], edge_lens: ['Close-Focus Lens', 'Saber damage +45%, reach +18'], nano_shunt: ['Nano Recovery Shunt', 'Regeneration +0.45; recover 3 HP every 20 normal kills'], execution: ['Execution Protocol', 'Instantly execute normal enemies below 15% HP'], echo_chamber: ['Resonance Chamber', 'Every sixth volley repeats at 70% damage'], gravity_halo: ['Gravity Halo', 'Nearby normal enemies move 24% slower'], soul_battery: ['Soul Battery', 'Recover 2 HP every 12 normal kills; all damage +12%'], event_horizon: ['Event Horizon', 'Orbitals +2, size +45%, damage +70%, adds shockwaves'], zero_edge: ['Zero Edge', 'Saber damage +80%, speed +33%, afterimage slash +1'], phoenix: ['Phoenix Kernel', 'Ignore one fatal hit and revive at 40% HP'], rift_crown: ['Rift Crown', 'All damage +35%, EXP +25%'], singularity: ['Arcana Singularity', 'All damage +60%, each build gains +25% additional damage'], immortal: ['Immortal Circuit', 'Max HP +30, regeneration +1, recover 2 HP every 8 normal kills'], godspeed: ['Godspeed Engine', 'Move +25%; greatly increases shot, saber, and orbital speed'], chain_detonator: ['Chain Detonation Core', 'Bomber explosions deal 30% damage to nearby enemies · +15%p per relic level · max 120%'],
      },
      mastery: {
        projectile: ['Constellation Shot Complete', 'Periodically fires a powerful piercing laser across the screen'], saber: ['Saber Technique Complete', 'Periodically unleashes a golden whirlwind slash in every direction'], orbit: ['Orbital Technique Complete', 'Orbitals chase enemies, explode, and then return to the player'],
      },
    },

    zh: {
      upgrade: {
        power: ['符文增幅', '所有攻击伤害 +12%'], haste: ['咏唱加速', '星座弹攻击间隔缩短 13%'], multishot: ['双星轨道', '同时发射的星座弹 +1'], pierce: ['相位贯穿', '星座弹贯穿次数 +1'], critical: ['命运干涉', '暴击率 +8%，暴击倍率 +0.18'], blast: ['崩坏余响', '星座弹命中时：爆炸半径 +22/LV（最高132）· 周围敌人受到主目标所受伤害的35%'], chain: ['连锁雷击', '星座弹命中时：210范围内落雷目标 +1/LV（最多5个）· 每个目标受到主目标所受伤害的28%'], size: ['巨型星核', '星座弹尺寸 +18%，伤害 +10%'],
        orbit: ['守护卫星体', '攻击卫星体 +1，解锁卫星体构筑'], orbit_speed: ['超高速公转', '卫星体旋转速度 +24%'], orbit_size: ['巨型卫星核', '卫星体尺寸 +20%，伤害 +16%'], orbit_range: ['双重公转面', '公转半径 +16，卫星体伤害 +10%'], orbit_shock: ['超新星放电', '卫星体命中时：放电概率 +12%p/LV（最高48%）· 半径90 · 周围敌人受到主目标所受伤害的42%'], orbit_pulse: ['脉动星环', '所有卫星体周期性释放冲击波'], orbit_guard: ['轨道拦截', '卫星体接触敌方导弹时有一定概率将其消除'], orbit_intercept: ['轨道拦截', '卫星体接触敌方导弹时有一定概率将其消除'],
        saber: ['星界光剑', '光剑伤害 +25%'], saber_reach: ['月光剑路', '光剑射程 +20，扩大斩击角度'], saber_haste: ['刹那拔刀', '光剑攻击间隔缩短 17%'], saber_echo: ['残影连击', '光剑额外残影斩 +1'], saber_guard: ['剑幕反射', '使用光剑时防御概率 +7%'], speed: ['空间跃迁', '移动速度 +11%'], magnet: ['重力井', '经验值吸取范围 +85'], vital: ['生命结界', '最大生命 +8，恢复 10 点生命'], regen: ['再生术式', '每秒生命恢复 +0.35'], guard: ['星座屏障', '免疫受击概率 +6%'], fortune: ['魔力精炼', '获得经验值 +22%'], relic_slot: ['次元收纳扩展', '遗物栏位 +1（最多 7）'],
        limit_master_projectile: ['星座炮极限突破', '完成激光伤害 +4%p、范围 +2%p、攻击间隔 -1%p/LV（间隔 -20%、范围上限 LV.20）'], limit_master_saber: ['光剑极限突破', '完成旋斩伤害 +4%p、范围 +2%p、攻击间隔 -1%p/LV（间隔 -20%、范围上限 LV.20）'], limit_master_orbit: ['卫星体极限突破', '完成追踪爆炸伤害 +4%p、范围 +2%p、攻击间隔 -1%p/LV（间隔 -20%、范围上限 LV.20）'], limit_power: ['极限突破 · 力量', '所有攻击伤害 +6%'], limit_vital: ['极限突破 · 生命', '最大生命 +5，恢复 5 点生命'], limit_growth: ['极限突破 · 共鸣', '经验值 +7%，吸取范围 +20'],
      },
      relic: {
        arc_cell: ['增幅电弧电池', '所有攻击伤害 +15%'], blood_cap: ['血流电容器', '最大生命 +12，首次获得时恢复 12 点生命'], magnet_prism: ['磁力棱镜', '吸取范围 +30%，经验值 +10%'], hunter_lens: ['猎人透镜', '暴击率 +8%，暴击伤害 +0.2'], split_core: ['分裂核心', '每第 4 次星座弹齐射增加 2 枚投射物'], orbit_gear: ['星环加速器', '卫星体 +1，速度 +30%，伤害 +30%'], edge_lens: ['近距聚焦透镜', '光剑伤害 +45%，射程 +18'], nano_shunt: ['纳米恢复分流器', '再生 +0.45，每击破 20 个普通敌人恢复 3 点生命'], execution: ['处决协议', '普通敌人生命低于 15% 时立即处决'], echo_chamber: ['共鸣弹舱', '每第 6 次齐射以 70% 伤害重复'], gravity_halo: ['重力光环', '周围普通敌人的移动速度降低 24%'], soul_battery: ['灵魂电池', '每击破 12 个普通敌人恢复 2 点生命，所有伤害 +12%'], event_horizon: ['事件视界', '卫星体 +2，尺寸 +45%，伤害 +70%，追加冲击波'], zero_edge: ['零式刀锋', '光剑伤害 +80%，速度 +33%，残影斩 +1'], phoenix: ['凤凰核心', '无视一次致命伤并以 40% 生命复活'], rift_crown: ['裂隙王冠', '所有伤害 +35%，经验值 +25%'], singularity: ['奥术奇点', '所有伤害 +60%，各构筑额外伤害 +25%'], immortal: ['不灭回路', '最大生命 +30，再生 +1，每击破 8 个普通敌人恢复 2 点生命'], godspeed: ['神速运算机关', '移动 +25%，大幅提升星座弹、光剑与卫星体速度'], chain_detonator: ['连锁起爆核心', '自爆敌人爆炸时对周围敌人造成 30% 伤害 · 每级遗物 +15%p · 最高 120%'],
      },
      mastery: {
        projectile: ['星座弹术式完成', '周期性发射贯穿屏幕的强力激光'], saber: ['光剑术式完成', '周期性发动横扫全方位的黄金旋斩'], orbit: ['卫星体术式完成', '卫星体追踪敌人并爆炸，随后返回玩家身边'],
      },
    },

    ja: {
      upgrade: {
        power: ['ルーン増幅', '全攻撃ダメージ +12%'], haste: ['詠唱加速', '星座弾の攻撃間隔 -13%'], multishot: ['双星軌道', '同時発射する星座弾 +1'], pierce: ['位相貫通', '星座弾の貫通回数 +1'], critical: ['運命干渉', 'クリティカル率 +8%、倍率 +0.18'], blast: ['崩壊残響', '星座弾命中時：爆発半径 +22/LV（最大132）· 周囲の敵に主対象へのダメージの35%'], chain: ['連鎖落雷', '星座弾命中時：距離210以内の落雷対象 +1/LV（最大5体）· 各対象に主対象へのダメージの28%'], size: ['巨大星核', '星座弾サイズ +18%、ダメージ +10%'],
        orbit: ['守護衛星体', '攻撃衛星体 +1、衛星体ビルドを解放'], orbit_speed: ['超高速公転', '衛星体の回転速度 +24%'], orbit_size: ['巨大衛星核', '衛星体サイズ +20%、ダメージ +16%'], orbit_range: ['二重公転面', '公転半径 +16、衛星体ダメージ +10%'], orbit_shock: ['超新星放電', '衛星体命中時：放電確率 +12%p/LV（最大48%）· 半径90 · 周囲の敵に主対象へのダメージの42%'], orbit_pulse: ['脈動星環', '全衛星体が周期的に衝撃波を放つ'], orbit_guard: ['軌道迎撃', '衛星体に触れた敵ミサイルを一定確率で消去'], orbit_intercept: ['軌道迎撃', '衛星体に触れた敵ミサイルを一定確率で消去'],
        saber: ['アストラル光剣', '光剣ダメージ +25%'], saber_reach: ['月光剣路', '光剣の射程 +20、斬撃角度拡大'], saber_haste: ['刹那抜刀', '光剣の攻撃間隔 -17%'], saber_echo: ['残像連撃', '光剣の追加残像斬り +1'], saber_guard: ['剣幕反射', '光剣使用中の防御確率 +7%'], speed: ['空間跳躍', '移動速度 +11%'], magnet: ['重力井戸', '経験値吸収範囲 +85'], vital: ['生命結界', '最大HP +8、HPを10回復'], regen: ['再生術式', '毎秒HP回復 +0.35'], guard: ['星座障壁', '被弾無効率 +6%'], fortune: ['魔力精製', '獲得経験値 +22%'], relic_slot: ['次元収納拡張', '遺物スロット +1（最大7）'],
        limit_master_projectile: ['星座砲限界突破', '完成レーザーのダメージ +4%p、範囲 +2%p、攻撃間隔 -1%p/LV（間隔 -20%・範囲はLV.20上限）'], limit_master_saber: ['光剣限界突破', '完成旋回斬りのダメージ +4%p、範囲 +2%p、攻撃間隔 -1%p/LV（間隔 -20%・範囲はLV.20上限）'], limit_master_orbit: ['衛星体限界突破', '完成追跡爆発のダメージ +4%p、範囲 +2%p、攻撃間隔 -1%p/LV（間隔 -20%・範囲はLV.20上限）'], limit_power: ['限界突破 · 力', '全攻撃ダメージ +6%'], limit_vital: ['限界突破 · 生命', '最大HP +5、HPを5回復'], limit_growth: ['限界突破 · 共鳴', '経験値 +7%、吸収範囲 +20'],
      },
      relic: {
        arc_cell: ['増幅アークセル', '全攻撃ダメージ +15%'], blood_cap: ['血流コンデンサ', '最大HP +12、初回獲得時にHPを12回復'], magnet_prism: ['磁力プリズム', '吸収範囲 +30%、経験値 +10%'], hunter_lens: ['狩人のレンズ', 'クリティカル率 +8%、クリティカルダメージ +0.2'], split_core: ['分裂コア', '4回目の星座弾一斉射撃ごとに投射体 +2'], orbit_gear: ['星環加速器', '衛星体 +1、速度 +30%、ダメージ +30%'], edge_lens: ['近接焦点レンズ', '光剣ダメージ +45%、射程 +18'], nano_shunt: ['ナノ回復分岐器', '再生 +0.45、通常敵20体撃破ごとにHPを3回復'], execution: ['処刑プロトコル', '通常敵のHPが15%未満なら即時処刑'], echo_chamber: ['共鳴弾室', '6回目の一斉射撃を70%ダメージで反復'], gravity_halo: ['重力後光', '周囲の通常敵の移動速度を24%低下'], soul_battery: ['魂のバッテリー', '通常敵12体撃破ごとにHPを2回復、全ダメージ +12%'], event_horizon: ['事象の地平線', '衛星体 +2、サイズ +45%、ダメージ +70%、衝撃波追加'], zero_edge: ['ゼロエッジ', '光剣ダメージ +80%、速度 +33%、残像斬り +1'], phoenix: ['フェニックス・カーネル', '致命傷を1回無視し、HP40%で復活'], rift_crown: ['亀裂の王冠', '全ダメージ +35%、経験値 +25%'], singularity: ['アルカナ特異点', '全ダメージ +60%、各ビルドの追加ダメージ +25%'], immortal: ['不滅回路', '最大HP +30、再生 +1、通常敵8体撃破ごとにHPを2回復'], godspeed: ['神速演算機関', '移動 +25%、星座弾・光剣・衛星体の速度が大幅上昇'], chain_detonator: ['連鎖起爆コア', '自爆敵の爆発時、周囲の敵に30%ダメージ · 遺物LVごとに+15%p · 最大120%'],
      },
      mastery: {
        projectile: ['星座弾術式完成', '周期的に画面を貫く強力なレーザーを発射'], saber: ['光剣術式完成', '周期的に全方向を薙ぐ黄金旋回斬りを発動'], orbit: ['衛星体術式完成', '衛星体が敵を追跡して爆発し、プレイヤーの周囲へ帰還'],
      },
    },
  };

  Object.keys(catalogs).forEach(locale => {
    Object.keys(catalogs[locale]).forEach(group => {
      Object.keys(catalogs[locale][group]).forEach(id => {
        const entry = catalogs[locale][group][id];
        messages[locale][`${group}.${id}.name`] = entry[0];
        messages[locale][`${group}.${id}.desc`] = entry[1];
      });
    });
  });

  function normalizeSupported(language) {
    if (typeof language !== 'string') return null;
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.includes(base) ? base : null;
  }

  function storedLanguage() {
    try {
      return normalizeSupported(global.localStorage && global.localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return null;
    }
  }

  function browserLanguage() {
    const primary = global.navigator && (
      (Array.isArray(global.navigator.languages) && global.navigator.languages[0]) ||
      global.navigator.language
    );
    const detected = normalizeSupported(primary);
    return detected === 'ko' || detected === 'zh' || detected === 'ja' ? detected : 'en';
  }

  function lookup(dictionary, key) {
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key];
    return key.split('.').reduce((value, part) => (
      value && typeof value === 'object' ? value[part] : undefined
    ), dictionary);
  }

  function interpolate(text, variables) {
    if (!variables || typeof variables !== 'object') return text;
    return text.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
    ));
  }

  let language = storedLanguage() || browserLanguage();
  const listeners = new Set();

  function t(key, variables) {
    const localized = lookup(messages[language], key);
    const fallback = lookup(messages.en, key);
    const value = typeof localized === 'string' ? localized : fallback;
    return interpolate(typeof value === 'string' ? value : String(key), variables);
  }

  function setLanguage(nextLanguage, persist = true) {
    const normalized = normalizeSupported(nextLanguage);
    if (!normalized) return false;

    const previous = language;
    language = normalized;
    try {
      if (persist && global.localStorage) global.localStorage.setItem(STORAGE_KEY, normalized);
    } catch (_) {
      // Storage can be unavailable for local files or strict privacy settings.
    }

    if (global.document && global.document.documentElement) {
      global.document.documentElement.lang = normalized === 'zh' ? 'zh-CN' : normalized;
    }

    if (previous !== normalized) {
      listeners.forEach(listener => {
        try { listener(normalized, previous); } catch (_) { /* Keep other listeners alive. */ }
      });
      if (typeof global.CustomEvent === 'function' && typeof global.dispatchEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('neon-i18n-change', {
          detail: { language: normalized, previousLanguage: previous },
        }));
      }
    }
    return true;
  }

  function getLanguage() {
    return language;
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function unsubscribe() { listeners.delete(listener); };
  }

  if (global.document && global.document.documentElement) {
    global.document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  }

  global.NeonI18n = Object.freeze({
    t,
    setLanguage,
    getLanguage,
    onChange,
    supportedLanguages: SUPPORTED,
    storageKey: STORAGE_KEY,
    hasStoredLanguage: () => Boolean(storedLanguage()),
  });
})(window);
