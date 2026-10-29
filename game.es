(() => {
  'use strict';

  const STEP = 10;
  const STARTING_CHIPS = 500;
  const SYMBOLS = [
    { id: 'sete', name: 'Sete', file: 'assets/sete.png', multiplier: 17 },
    { id: 'coracao', name: 'Coração', file: 'assets/coracao.png', multiplier: 13 },
    { id: 'cereja', name: 'Cereja', file: 'assets/cereja.png', multiplier: 10 },
    { id: 'diamante', name: 'Diamante', file: 'assets/diamante.png', multiplier: 8 },
    { id: 'espadilha', name: 'Espadilha', file: 'assets/espadilha.png', multiplier: 6 },
  ];

  const $ = (id) => document.getElementById(id);
  const ui = {
    balance: $('balanceValue'),
    rounds: $('roundValue'),
    returned: $('returnValue'),
    bet: $('betValue'),
    result: $('resultMessage'),
    reels: [ $('reel0'), $('reel1'), $('reel2') ],
    plus: $('plusBtn'),
    minus: $('minusBtn'),
    max: $('maxBtn'),
    spin: $('spinBtn'),
    sound: $('soundBtn'),
    instructions: $('instructionsDialog'),
    credits: $('creditsDialog'),
    creditsForm: $('creditsForm'),
    creditsAmount: $('creditsAmount'),
    toast: $('toast'),
  };

  let state = loadState();
  let busy = false;
  let soundOn = true;
  let toastTimer;
  const audio = {
    click: new Audio('assets/click.mp3'),
    spin: new Audio('assets/slot.mp3'),
    win: new Audio('assets/cash.mp3'),
  };
  audio.spin.loop = true;
  Object.values(audio).forEach((sound) => { sound.preload = 'auto'; sound.volume = 0.55; });

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem('giro-da-sorte-state') || 'null');
      if (saved && Number.isFinite(saved.balance) && Number.isFinite(saved.bet) && Number.isFinite(saved.rounds)) {
        return {
          balance: Math.max(0, Math.floor(saved.balance)),
          bet: Math.max(0, Math.floor(saved.bet)),
          rounds: Math.max(0, Math.floor(saved.rounds)),
          lastReturn: Number.isFinite(saved.lastReturn) ? Math.floor(saved.lastReturn) : 0,
        };
      }
    } catch (_) { /* armazenamento local indisponível: usa estado temporário */ }
    return { balance: STARTING_CHIPS, bet: 0, rounds: 0, lastReturn: 0 };
  }

  function saveState() {
    try { localStorage.setItem('giro-da-sorte-state', JSON.stringify(state)); }
    catch (_) { /* o jogo continua funcionando sem persistência */ }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
  }

  function render() {
    ui.balance.textContent = formatNumber(state.balance);
    ui.rounds.textContent = formatNumber(state.rounds);
    ui.returned.textContent = formatNumber(state.lastReturn);
    ui.bet.textContent = formatNumber(state.bet);
    ui.plus.disabled = busy || state.balance < STEP;
    ui.minus.disabled = busy || state.bet < STEP;
    ui.max.disabled = busy || state.balance < 1;
    ui.spin.disabled = busy || state.bet < STEP;
    saveState();
  }

  function playSound(name) {
    if (!soundOn) return;
    const sound = audio[name];
    if (!sound) return;
    try {
      if (name !== 'spin') sound.currentTime = 0;
      const playback = sound.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => {});
    } catch (_) { /* áudio é opcional e pode estar bloqueado pelo navegador */ }
  }

  function stopSpinSound() {
    audio.spin.pause();
    audio.spin.currentTime = 0;
  }

  function setResult(message, tone = '') {
    ui.result.textContent = message;
    ui.result.classList.remove('win', 'loss');
    if (tone) ui.result.classList.add(tone);
  }

  function announce(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('visible'), 2400);
  }

  function setSymbol(reel, symbol) {
    const image = reel.querySelector('img');
    image.src = symbol.file;
    image.alt = `Símbolo ${symbol.name.toLowerCase()}`;
  }

  function randomSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  function playRound() {
    if (busy || state.bet < STEP) return;
    busy = true;
    setResult('Os rolos estão girando…');
    playSound('click');
    playSound('spin');
    ui.reels.forEach((reel) => reel.classList.add('spinning'));

    const shuffle = setInterval(() => {
      ui.reels.forEach((reel) => setSymbol(reel, randomSymbol()));
    }, 95);

    setTimeout(() => {
      clearInterval(shuffle);
      const result = [randomSymbol(), randomSymbol(), randomSymbol()];
      ui.reels.forEach((reel, index) => {
        reel.classList.remove('spinning');
        setSymbol(reel, result[index]);
      });
      stopSpinSound();

      const bet = state.bet;
      const threeOfAKind = result.every((symbol) => symbol.id === result[0].id);
      const anyPair = result[0].id === result[1].id || result[0].id === result[2].id || result[1].id === result[2].id;
      let returned = 0;
      let message = 'Não saiu combinação: a aposta não retornou.';
      let tone = 'loss';

      if (threeOfAKind) {
        returned = bet * result[0].multiplier;
        state.balance += returned;
        message = `TRÊS ${result[0].name.toUpperCase()}! +${formatNumber(returned)} fichas`;
        tone = 'win';
        playSound('win');
      } else if (anyPair) {
        returned = Math.floor(bet / 2);
        state.balance += returned;
        message = `Saiu um par — metade da aposta voltou: ${formatNumber(returned)} fichas.`;
        tone = 'loss';
      }

      state.bet = 0;
      state.rounds += 1;
      state.lastReturn = returned;
      busy = false;
      setResult(message, tone);
      render();
    }, 1150);
  }

  ui.plus.addEventListener('click', () => {
    if (busy || state.balance < STEP) return;
    playSound('click');
    state.balance -= STEP;
    state.bet += STEP;
    setResult('Aposta atualizada. Quando quiser, gire os rolos.');
    render();
  });

  ui.minus.addEventListener('click', () => {
    if (busy || state.bet < STEP) return;
    playSound('click');
    state.bet -= STEP;
    state.balance += STEP;
    setResult('Devolvemos 10 fichas à sua carteira.');
    render();
  });

  ui.max.addEventListener('click', () => {
    if (busy || state.balance < 1) return;
    playSound('click');
    state.bet += state.balance;
    state.balance = 0;
    setResult('Aposta máxima selecionada.');
    render();
  });

  ui.spin.addEventListener('click', playRound);

  $('soundBtn').addEventListener('click', () => {
    soundOn = !soundOn;
    if (!soundOn) stopSpinSound();
    ui.sound.textContent = soundOn ? '♪' : '♫̸';
    ui.sound.title = soundOn ? 'Som ligado' : 'Som desligado';
    ui.sound.setAttribute('aria-label', soundOn ? 'Desativar som' : 'Ativar som');
    ui.sound.setAttribute('aria-pressed', String(!soundOn));
    if (soundOn) playSound('click');
  });

  $('addCreditsBtn').addEventListener('click', () => {
    ui.creditsAmount.value = '500';
    ui.credits.showModal();
  });

  ui.creditsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const amount = Number(ui.creditsAmount.value);
    if (!Number.isInteger(amount) || amount < STEP || amount > 1000000 || amount % STEP !== 0) {
      ui.creditsAmount.setCustomValidity('Informe um número inteiro entre 10 e 1.000.000, em intervalos de 10.');
      ui.creditsAmount.reportValidity();
      return;
    }
    ui.creditsAmount.setCustomValidity('');
    state.balance += amount;
    ui.credits.close();
    setResult(`${formatNumber(amount)} fichas fictícias foram adicionadas.`);
    announce('Fichas fictícias adicionadas. Nenhuma transação foi realizada.');
    render();
  });

  $('instructionsBtn').addEventListener('click', () => ui.instructions.showModal());
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  $('resetBtn').addEventListener('click', () => {
    if (busy) return;
    const confirmed = window.confirm('Reiniciar a demonstração e voltar para 500 fichas fictícias?');
    if (!confirmed) return;
    state = { balance: STARTING_CHIPS, bet: 0, rounds: 0, lastReturn: 0 };
    ui.reels.forEach((reel, index) => setSymbol(reel, SYMBOLS[index]));
    setResult('Demonstração reiniciada. Escolha uma aposta e gire os rolos.');
    render();
  });

  ui.creditsAmount.addEventListener('input', () => ui.creditsAmount.setCustomValidity(''));
  render();
})();
