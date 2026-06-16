import { createClient } from '@supabase/supabase-js'

// ===== Supabase 初期化 =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===== 定数 =====
const COLORS = [
  { name: '青',    g: ['#6ec6f5', '#1a5fb4'] },
  { name: '赤',    g: ['#f88',    '#c0392b'] },
  { name: '緑',    g: ['#8eda6e', '#2e7d32'] },
  { name: '黄色',  g: ['#ffe066', '#c8960c'] },
  { name: 'ピンク',g: ['#f9a8d4', '#be185d'] },
  { name: '白',    g: ['#f0f0f0', '#999']    },
]

// ===== 状態 =====
let roomId = null
let myPlayerId = null  // 1 or 2
let room = null        // rooms row
let guesses = { 1: [], 2: [] }
let workSlots = [null, null, null, null]
let channel = null
let role = 'player' // 'player' | 'spectator'
let hadTwoPlayers = false
let rematchRequested = false

// ===== SVG ヘルパー =====
function svgM(c, sz = 40) {
  const id = 'm' + Math.random().toString(36).slice(2, 8)
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="${id}" cx="33%" cy="28%" r="62%">
      <stop offset="0%" stop-color="${c.g[0]}"/>
      <stop offset="100%" stop-color="${c.g[1]}"/>
    </radialGradient></defs>
    <circle cx="20" cy="20" r="19" fill="url(#${id})"/>
    <circle cx="13" cy="12" r="5.5" fill="white" opacity="0.28"/>
  </svg>`
}
function svgEmpty(sz = 40) {
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="19" fill="#1a1a1a"/>
    <circle cx="20" cy="20" r="12" fill="#141414"/>
  </svg>`
}

// ===== ユーティリティ =====
function nanoid(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
function shuffle(a) {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
function getGuestId() {
  let id = sessionStorage.getItem('guestId')
  if (!id) { id = 'g_' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('guestId', id) }
  return id
}
function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg; t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 1600)
}
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'))
  document.getElementById('screen-' + name).classList.remove('hidden')
}
function evaluate(guess, ans) {
  let hit = 0, blow = 0
  const usedAns = [false, false, false, false]
  const usedGuess = [false, false, false, false]
  for (let i = 0; i < 4; i++) {
    if (guess[i] === ans[i]) { hit++; usedAns[i] = true; usedGuess[i] = true }
  }
  for (let i = 0; i < 4; i++) {
    if (usedGuess[i]) continue
    for (let j = 0; j < 4; j++) {
      if (usedAns[j]) continue
      if (guess[i] === ans[j]) { blow++; usedAns[j] = true; break }
    }
  }
  return { hit, blow }
}

// ===== 画面 UI =====
function renderBoard() {
  const ba = document.getElementById('board-area')
  ba.innerHTML = ''
  const total = guesses[1].length + guesses[2].length
  const isMyTurn = room && room.status === 'playing' && room.current_player === myPlayerId
  const gameOver = room && room.status === 'finished'

  for (let col = 1; col <= 8; col++) {
    const p = (col % 2 === 1) ? 1 : 2
    const gi = Math.ceil(col / 2) - 1
    const g = guesses[p][gi]
    const isActive = !gameOver && col === (total + 1) && p === room?.current_player && isMyTurn

    const div = document.createElement('div')
    div.className = 'col'
    div.innerHTML = `<div class="col-num">${col}<span class="arr">▶</span></div>`

    // hint box
    const hbox = document.createElement('div'); hbox.className = 'hint-box'
    if (g) {
      const dots = []
      for (let i = 0; i < g.hit; i++) dots.push('hit')
      for (let i = 0; i < g.blow; i++) dots.push('blow')
      while (dots.length < 4) dots.push('')
      hbox.innerHTML = dots.map(t => `<div class="hd ${t}"></div>`).join('')
    } else {
      hbox.innerHTML = '<div class="hd"></div>'.repeat(4)
    }
    div.appendChild(hbox)

    // slot panel
    const panel = document.createElement('div')
    panel.className = 'vslot-panel' + (isActive ? ' glow' : '')
    for (let row = 0; row < 4; row++) {
      const s = document.createElement('div')
      if (g) {
        const c = COLORS.find(x => x.name === g.colors[row])
        s.className = 'vslot'
        s.innerHTML = svgM(c, 38)
      } else if (isActive) {
        if (workSlots[row]) {
          const c = COLORS.find(x => x.name === workSlots[row])
          s.className = 'vslot filled-active'
          s.innerHTML = svgM(c, 38)
          s.onclick = (r => () => removeSlot(r))(row)
        } else {
          s.className = 'vslot empty-active'
          s.innerHTML = svgEmpty(38)
        }
      } else {
        s.className = 'vslot'
        s.innerHTML = svgEmpty(38)
      }
      panel.appendChild(s)
    }
    div.appendChild(panel)

    const lbl = document.createElement('div')
    lbl.className = 'plabel'
    if (p === myPlayerId) {
      lbl.innerHTML = `<span class="my-badge">P${p}（あなた）</span>`
    } else {
      lbl.textContent = `P${p}`
    }
    div.appendChild(lbl)
    ba.appendChild(div)
  }

  // answer column
  const ac = document.createElement('div'); ac.className = 'ans-col'
  ac.innerHTML = `<div class="col-num"></div>`
  const hspacer = document.createElement('div')
  hspacer.style.cssText = 'width:52px;height:44px;'
  ac.appendChild(hspacer)

  const lidOuter = document.createElement('div'); lidOuter.className = 'lid-outer'
  const mWrap = document.createElement('div'); mWrap.className = 'lid-marbles'
  if (room) {
    room.answer.forEach(name => {
      const s = document.createElement('div'); s.className = 'vslot'
      s.style.background = '#1e1e1e'
      s.innerHTML = svgM(COLORS.find(x => x.name === name), 38)
      mWrap.appendChild(s)
    })
  }
  lidOuter.appendChild(mWrap)
  const lid = document.createElement('div')
  lid.className = 'lid-cover' + (gameOver ? ' open' : '')
  lid.innerHTML = `<svg width="34" height="50" viewBox="0 0 34 50" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="20" width="26" height="4" rx="2" fill="#333" opacity="0.8"/>
    <rect x="4" y="28" width="26" height="4" rx="2" fill="#333" opacity="0.8"/>
  </svg>`
  lidOuter.appendChild(lid)
  ac.appendChild(lidOuter)
  ba.appendChild(ac)
}

function renderPalette() {
  const pr = document.getElementById('palette-row')
  pr.innerHTML = ''
  COLORS.forEach(c => {
    const btn = document.createElement('button')
    btn.className = 'pbt'
    btn.title = c.name
    btn.innerHTML = svgM(c, 44)
    btn.onclick = () => addColor(c.name)
    pr.appendChild(btn)
  })
}

function renderTurnChip() {
  if (!room) return
  const chip = document.getElementById('turn-chip')
  const inputArea = document.getElementById('input-area')

  // 👀 観戦者
  if (role === 'spectator') {
    chip.textContent = '👀 観戦中'
    chip.className = 'turn-chip wait-turn'
    inputArea.classList.add('disabled')
    return
  }

  // 既存ロジック（そのまま）
  const isMyTurn = room.current_player === myPlayerId && room.status === 'playing'
  const totalTurns = guesses[1].length + guesses[2].length

  if (room.status === 'waiting') {
    chip.textContent = '相手の参加を待っています...'
    chip.className = 'turn-chip wait-turn'
    inputArea.classList.add('disabled')
  } else if (room.status === 'finished') {
    chip.className = 'turn-chip'
    inputArea.classList.add('disabled')
  } else if (isMyTurn) {
    chip.textContent = `🟢 あなたのターン（第${Math.ceil((totalTurns + 1) / 2)}回）`
    chip.className = 'turn-chip my-turn'
    inputArea.classList.remove('disabled')
  } else {
    chip.textContent = `相手のターンです...`
    chip.className = 'turn-chip wait-turn'
    inputArea.classList.add('disabled')
  }
}

function renderAll() {
  renderBoard()
  renderPalette()
  renderTurnChip()
  document.getElementById('submit-btn').disabled = workSlots.includes(null)
}

// ===== スロット操作 =====
function addColor(name) {
  const idx = workSlots.indexOf(null)
  if (idx < 0) return
  workSlots[idx] = name
  renderBoard()
  document.getElementById('submit-btn').disabled = workSlots.includes(null)
}
function removeSlot(i) {
  if (!workSlots[i]) return
  workSlots[i] = null
  renderBoard()
  document.getElementById('submit-btn').disabled = true
}
function clearWork() {
  workSlots = [null, null, null, null]
  renderBoard()
  document.getElementById('submit-btn').disabled = true
}

// ===== 推測送信 =====
async function submitGuess() {
  if (role !== 'player') return
  if (workSlots.includes(null) || !room || room.status !== 'playing') return
  if (room.current_player !== myPlayerId) return

  const guess = [...workSlots]
  const r = evaluate(guess, room.answer)
  const turn = guesses[myPlayerId].length + 1

  // guesses テーブルに挿入
  const { error: gErr } = await supabase.from('guesses').insert({
    room_id: roomId,
    player: myPlayerId,
    turn,
    colors: guess,
    hit: r.hit,
    blow: r.blow,
  })
  if (gErr) { console.error(gErr); showToast('エラーが発生しました'); return }

  workSlots = [null, null, null, null]
  showToast(r.hit === 4 ? `🎉 4ヒット！` : `${r.hit}ヒット  ${r.blow}ブロー`)

  // ルーム状態更新
  const total = guesses[1].length + guesses[2].length + 1
  const nextPlayer = myPlayerId === 1 ? 2 : 1

  if (r.hit === 4) {
    await supabase.from('rooms').update({ status: 'finished', winner: myPlayerId }).eq('id', roomId)
  } else if (total >= 8) {
    await supabase.from('rooms').update({ status: 'finished', winner: null }).eq('id', roomId)
  } else {
    await supabase.from('rooms').update({ current_player: nextPlayer }).eq('id', roomId)
  }
}

// ===== 先後選択（P2が実行） =====
async function selectOrder(goFirst) {
  if (myPlayerId !== 2 || !roomId) return

  // goFirst=true → P2が先行(player1)になる → player1_id, player2_idを入れ替え
  const guestId = getGuestId()
  const { data: r } = await supabase.from('rooms').select('player1_id, player2_id').eq('id', roomId).single()
  if (!r) return

  const update = goFirst
    ? { player1_id: guestId, player2_id: r.player1_id, current_player: 1, status: 'playing' }
    : { status: 'playing', current_player: 1 }

  await supabase.from('rooms').update(update).eq('id', roomId)

  // 自分のplayerIdを再設定
  myPlayerId = goFirst ? 1 : 2
}


function showResult() {
  if (!room) return
  const overlay = document.getElementById('result-overlay')
  const title = document.getElementById('res-title')
  const sub = document.getElementById('res-sub')
  const ra = document.getElementById('res-ans')

  const total = guesses[1].length + guesses[2].length
  if (room.winner) {
    title.textContent = room.winner === myPlayerId ? '🎉 あなたの勝ち！' : '😢 相手の勝ち...'
    sub.textContent = `合計${total}回で正解しました！`
  } else {
    title.textContent = '引き分け...'
    sub.textContent = `8回でどちらも正解できませんでした`
  }

  ra.innerHTML = ''
  room.answer.forEach(name => {
    const d = document.createElement('div')
    d.innerHTML = svgM(COLORS.find(x => x.name === name), 42)
    ra.appendChild(d)
  })

  // 再戦ボタン初期化
  rematchRequested = false
  const rematchBtn = document.getElementById('rematch-btn')
  const rematchWaiting = document.getElementById('rematch-waiting')
  rematchBtn.disabled = false
  rematchBtn.textContent = '再戦する'
  rematchWaiting.classList.add('hidden')

  // 観戦者は再戦ボタン非表示
  if (role === 'spectator') {
    rematchBtn.classList.add('hidden')
  } else {
    rematchBtn.classList.remove('hidden')
  }

  overlay.classList.remove('hidden')
}

// ===== 再戦リクエスト =====
async function requestRematch() {
  if (rematchRequested || role !== 'player' || !roomId) return
  rematchRequested = true

  const rematchBtn = document.getElementById('rematch-btn')
  const rematchWaiting = document.getElementById('rematch-waiting')
  rematchBtn.disabled = true
  rematchBtn.textContent = '待機中...'
  rematchWaiting.classList.remove('hidden')

  const field = myPlayerId === 1 ? 'rematch_p1' : 'rematch_p2'
  await supabase.from('rooms').update({ [field]: true }).eq('id', roomId)
}

// ===== 再戦リセット（P1が担当） =====
async function resetForRematch() {
  if (myPlayerId !== 1) return
  const newAnswer = shuffle(COLORS).slice(0, 4).map(c => c.name)
  await supabase.from('guesses').delete().eq('room_id', roomId)
  await supabase.from('rooms').update({
    answer: newAnswer,
    status: 'selecting',
    current_player: 1,
    winner: null,
    rematch_p1: false,
    rematch_p2: false,
  }).eq('id', roomId)
}

// ===== ゲームリスタート（クライアント側） =====
function restartGame() {
  guesses = { 1: [], 2: [] }
  workSlots = [null, null, null, null]
  rematchRequested = false
  document.getElementById('result-overlay').classList.add('hidden')
  renderAll()
  showToast('🔄 再戦開始！')
}

// ===== Supabase Realtime 購読 =====
function subscribeRoom() {
  channel = supabase.channel('room:' + roomId, {
    config: {
      presence: { key: getGuestId() }
    }
  })

  // ===== presence =====
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()

    const playersOnline = Object.values(state)
      .flat()
      .filter(p => p.role === 'player')
      .length

    if (playersOnline >= 2) {
      hadTwoPlayers = true
    }

    if (
      room?.status === 'playing' &&
      hadTwoPlayers &&
      playersOnline === 1
    ) {
      showToast('相手が退出しました')
      setTimeout(() => location.href = '/', 2000)
    }
  })

  // ===== rooms changes =====
  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
    async payload => {
      const prev = room
      room = payload.new
      renderAll()

      if (room.status === 'finished' && prev?.status !== 'finished') {
        setTimeout(showResult, 900)
      }

      // selecting → 選択画面表示
      if (room.status === 'selecting' && prev?.status === 'waiting') {
        if (role === 'player') {
          showScreen(myPlayerId === 2 ? 'select' : 'select-wait')
        }
        return
      }

      // selecting → playing（P1は自分のIDを再確認してからゲームへ）
      if (room.status === 'playing' && prev?.status === 'selecting') {
        const guestId = getGuestId()
        // player1_idが変わった可能性があるので再確認
        if (room.player1_id === guestId) myPlayerId = 1
        else if (room.player2_id === guestId) myPlayerId = 2
        showScreen('game')
        renderAll()
        return
      }

      // 両者が再戦リクエスト済み → P1がリセット実行
      if (
        room.status === 'finished' &&
        room.rematch_p1 && room.rematch_p2
      ) {
        if (myPlayerId === 1) {
          await resetForRematch()
        }
        return
      }

      // statusがselecting & 直前がfinished → 再戦の選択画面へ
      if (room.status === 'selecting' && prev?.status === 'finished') {
        guesses = { 1: [], 2: [] }
        workSlots = [null, null, null, null]
        rematchRequested = false
        document.getElementById('result-overlay').classList.add('hidden')
        // P2が先後を再選択、P1は待機
        showScreen(myPlayerId === 2 ? 'select' : 'select-wait')
        return
      }

      // statusがplaying & 直前がfinished → 直接再戦開始（selectingスキップ時の保険）
      if (room.status === 'playing' && prev?.status === 'finished') {
        restartGame()
        return
      }

      if (room.status === 'playing' && prev?.status !== 'finished') {
        showScreen('game')
      }

      // 相手が再戦を押した通知
      if (room.status === 'finished' && prev?.status === 'finished') {
        const opponentField = myPlayerId === 1 ? 'rematch_p2' : 'rematch_p1'
        const prevOpponent = prev?.[opponentField]
        if (!prevOpponent && room[opponentField] && !rematchRequested) {
          showToast('相手が再戦を希望しています！')
        }
      }
    }
  )

  // ===== guesses changes =====
  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'guesses', filter: `room_id=eq.${roomId}` },
    payload => {
      const g = payload.new
      if (!guesses[g.player]) guesses[g.player] = []
      guesses[g.player].push({
        colors: g.colors,
        hit: g.hit,
        blow: g.blow
      })
      renderAll()
    }
  )

  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ online: true, role })
    }
  })
}

// ===== 全データ取得（再接続時など） =====
async function loadRoomData() {
  const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).single()
  if (!r) return false
  room = r

  const { data: gs } = await supabase.from('guesses').select('*').eq('room_id', roomId).order('created_at')
  guesses = { 1: [], 2: [] }
  if (gs) {
    gs.forEach(g => guesses[g.player].push({ colors: g.colors, hit: g.hit, blow: g.blow }))
  }
  return true
}

// ===== ルーム作成 =====
async function createRoom() {
  const guestId = getGuestId()
  const id = nanoid()
  const answer = shuffle(COLORS).slice(0, 4).map(c => c.name)

  const { error } = await supabase.from('rooms').insert({
    id,
    answer,
    status: 'waiting',
    current_player: 1,
    player1_id: guestId,
  })
  if (error) { console.error(error); showLobbyError('ルームの作成に失敗しました'); return }

  roomId = id
  myPlayerId = 1
  room = { id, answer, status: 'waiting', current_player: 1 }

  // 待機画面
  showScreen('waiting')
  const url = `${location.origin}${location.pathname}?room=${id}`
  document.getElementById('share-url').textContent = url
  document.getElementById('copy-btn').onclick = () => {
    navigator.clipboard.writeText(url)
    showToast('コピーしました！')
  }

  subscribeRoom()
}

// ===== ルーム参加 =====
async function joinRoom(id) {
  hadTwoPlayers = false
  const guestId = getGuestId()
  roomId = id.toUpperCase()

  const { data: r } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (!r) { showLobbyError('ルームが見つかりません'); return }

  room = r

  // ===== プレイヤー判定 =====
  if (r.player1_id === guestId) {
    myPlayerId = 1
    role = 'player'
  } else if (r.player2_id === guestId) {
    myPlayerId = 2
    role = 'player'
  } else if (!r.player2_id) {
    // 2人目として参加 → 先後選択フェーズへ
    myPlayerId = 2
    role = 'player'
    const { error } = await supabase.from('rooms').update({
      player2_id: guestId,
      status: 'selecting',
    }).eq('id', roomId).eq('status', 'waiting')
    if (error) { showLobbyError('参加に失敗しました'); return }
  } else {
    // 👀 観戦者
    role = 'spectator'
    myPlayerId = null
  }

  await loadRoomData()

  if (role === 'spectator') {
    showScreen('game')
    renderAll()
    showToast('👀 観戦モードで参加しています')
  } else if (room.status === 'selecting') {
    // P2なら選択画面、P1なら待機画面
    showScreen(myPlayerId === 2 ? 'select' : 'select-wait')
  } else if (room.status === 'playing' || room.status === 'finished') {
    showScreen('game')
    renderAll()
  } else {
    showScreen('waiting')
    renderAll()
  }

  subscribeRoom()
}

function showLobbyError(msg) {
  document.getElementById('lobby-error').textContent = msg
}

// ===== URLパラメータ処理 =====
function init() {
  const params = new URLSearchParams(location.search)
  const rid = params.get('room')

  if (rid) {
    showScreen('lobby')
    joinRoom(rid)
    return
  }

  showScreen('lobby')

  document.getElementById('create-btn').onclick = createRoom

  document.getElementById('join-btn').onclick = () => {
    const v = document.getElementById('join-input').value.trim()
    if (!v) { showLobbyError('ルームIDを入力してください'); return }
    joinRoom(v)
  }
  document.getElementById('join-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('join-btn').click()
  })
}

// ===== イベントバインド（ゲーム画面） =====
document.getElementById('submit-btn').onclick = submitGuess
document.getElementById('clear-btn').onclick = clearWork
document.getElementById('leave-btn').onclick = async () => {
  if (!confirm('退出しますか？')) return
  if (channel) await channel.untrack()
  location.href = '/'
}
document.getElementById('rematch-btn').onclick = requestRematch
document.getElementById('quit-btn').onclick = async () => {
  if (channel) await channel.untrack()
  location.href = '/'
}
document.getElementById('select-first-btn').onclick = () => selectOrder(true)
document.getElementById('select-second-btn').onclick = () => selectOrder(false)

init()