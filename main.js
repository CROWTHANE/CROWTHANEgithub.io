// Retro Arcade: Pong, Snake, Breakout in one file.
// Basic SPA routing between home and game-screen; each game is a class with start/stop.

(() => {
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  // UI elements
  const homeView = qs('#home');
  const gameView = qs('#game-screen');
  const canvas = qs('#gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const titleEl = qs('#game-title');
  const scoreEl = qs('#score');
  const pauseBtn = qs('#pause-btn');
  const backBtn = qs('#back-btn');
  const msgEl = qs('#game-msg');

  // High score elements
  const hsPong = qs('#hs-pong');
  const hsSnake = qs('#hs-snake');
  const hsBreakout = qs('#hs-breakout');

  function getHS(key){ return parseInt(localStorage.getItem('hs-'+key) || '0',10); }
  function setHS(key, v){ localStorage.setItem('hs-'+key, String(v)); }

  // populate highs
  hsPong.textContent = getHS('pong');
  hsSnake.textContent = getHS('snake');
  hsBreakout.textContent = getHS('breakout');

  // View switching
  function showHome(){
    stopCurrentGame();
    titleEl.textContent = '';
    homeView.classList.remove('hidden');
    gameView.classList.add('hidden');
    msgEl.classList.add('hidden');
  }

  function showGame(gameName, difficulty){
    homeView.classList.add('hidden');
    gameView.classList.remove('hidden');
    msgEl.classList.add('hidden');
    titleEl.textContent = gameName.charAt(0).toUpperCase() + gameName.slice(1);
    scoreEl.textContent = 'Score: 0';
    startGame(gameName, difficulty);
  }

  // Game management
  let currentGame = null;
  function stopCurrentGame(){
    if(currentGame && typeof currentGame.stop === 'function'){
      currentGame.stop();
      currentGame = null;
    }
  }

  // Pause handling
  let paused = false;
  pauseBtn.addEventListener('click', () => {
    if(!currentGame) return;
    paused = !paused;
    currentGame.setPaused && currentGame.setPaused(paused);
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    msgEl.classList.toggle('hidden', !paused);
    msgEl.textContent = paused ? 'Paused' : '';
  });

  backBtn.addEventListener('click', () => showHome());

  // Play buttons
  qsa('.play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const g = btn.dataset.game;
      showGame(g);
    });
  });

  // keyboard pause toggle
  window.addEventListener('keydown', (e) => {
    if(e.key === 'p' || e.key === 'P'){
      pauseBtn.click();
    }
  });

  // Basic game classes follow. Each uses canvas size directly.

  // --- Pong ---
  class PongGame {
    constructor(canvas, onEnd){
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.onEnd = onEnd;
      this.w = canvas.width; this.h = canvas.height;
      this.reset();
      this._bind();
      this.running = false;
    }
    reset(){
      this.ball = { x: this.w/2, y: this.h/2, r:8, vx: 280*(Math.random()>0.5?1:-1), vy: 120*(Math.random()*2-1) };
      this.paddleH = 90; this.pw = 12;
      this.player = { x:20, y: (this.h - this.paddleH)/2, vy:0, speed: 380 };
      this.ai = { x: this.w - 20 - this.pw, y: (this.h - this.paddleH)/2, speed: 260 };
      this.score = { player:0, ai:0 };
      this.maxScore = 7;
      this.keys = {};
    }
    _bind(){
      this._onKey = (e) => {
        const k = e.key;
        const isDown = e.type === 'keydown';
        if(k==='w' || k==='W' || k==='ArrowUp') this.keys.up = isDown;
        if(k==='s' || k==='S' || k==='ArrowDown') this.keys.down = isDown;
      };
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('keyup', this._onKey);
    }
    start(){
      this.last = performance.now();
      this.running = true;
      this._loop();
    }
    setPaused(p){
      this.paused = p;
      if(!p && !this.running){
        this.last = performance.now();
        this.running = true;
        this._loop();
      }
    }
    stop(){
      this.running = false;
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('keyup', this._onKey);
    }
    _loop(){
      if(!this.running) return;
      if(!this.paused){
        const now = performance.now();
        const dt = Math.min(40, now - this.last)/1000;
        this.update(dt);
        this.draw();
        this.last = now;
      }
      requestAnimationFrame(()=>this._loop());
    }
    update(dt){
      // player input
      if(this.keys.up) this.player.y -= this.player.speed*dt;
      if(this.keys.down) this.player.y += this.player.speed*dt;
      this.player.y = Math.max(0, Math.min(this.h - this.paddleH, this.player.y));

      // ai simple follow
      const target = this.ball.y - this.paddleH/2;
      if(this.ai.y + this.paddleH/2 < this.ball.y - 6) this.ai.y += this.ai.speed*dt;
      if(this.ai.y + this.paddleH/2 > this.ball.y + 6) this.ai.y -= this.ai.speed*dt;
      this.ai.y = Math.max(0, Math.min(this.h - this.paddleH, this.ai.y));

      // ball move
      this.ball.x += this.ball.vx*dt;
      this.ball.y += this.ball.vy*dt;

      // top/bottom
      if(this.ball.y - this.ball.r < 0){ this.ball.y = this.ball.r; this.ball.vy *= -1; }
      if(this.ball.y + this.ball.r > this.h){ this.ball.y = this.h - this.ball.r; this.ball.vy *= -1; }

      // paddle collisions
      // player
      if(this.ball.x - this.ball.r < this.player.x + this.pw){
        if(this.ball.y > this.player.y && this.ball.y < this.player.y + this.paddleH){
          this.ball.x = this.player.x + this.pw + this.ball.r;
          this._reflectFromPaddle(this.player);
        } else {
          // AI scores
          this.score.ai += 1;
          this._resetBall(-1);
        }
      }
      // ai
      if(this.ball.x + this.ball.r > this.ai.x){
        if(this.ball.y > this.ai.y && this.ball.y < this.ai.y + this.paddleH){
          this.ball.x = this.ai.x - this.ball.r;
          this._reflectFromPaddle(this.ai);
        } else {
          // player scores
          this.score.player += 1;
          this._resetBall(1);
        }
      }

      // update displayed score
      scoreEl.textContent = `Score: ${this.score.player}`;
      if(this.score.player >= this.maxScore || this.score.ai >= this.maxScore){
        const winner = this.score.player > this.score.ai ? 'player' : 'ai';
        this.endGame(winner);
      }
    }
    _reflectFromPaddle(paddle){
      const relative = (this.ball.y - (paddle.y + this.paddleH/2)) / (this.paddleH/2);
      const speed = Math.sqrt(this.ball.vx*this.ball.vx + this.ball.vy*this.ball.vy);
      const angle = relative * Math.PI/3; // bounce angle
      const dir = (this.ball.x < this.w/2) ? 1 : -1;
      this.ball.vx = dir * Math.cos(angle) * Math.max(200, speed*1.05);
      this.ball.vy = Math.sin(angle) * Math.max(150, speed*1.02);
    }
    _resetBall(direction){
      this.ball.x = this.w/2; this.ball.y = this.h/2;
      const sign = direction || (Math.random()>0.5?1:-1);
      this.ball.vx = 300 * sign;
      this.ball.vy = 120*(Math.random()*2-1);
    }
    draw(){
      const ctx = this.ctx;
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,this.w,this.h);

      // dashed center line
      ctx.strokeStyle = 'rgba(57,255,20,0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10,10]);
      ctx.beginPath();
      ctx.moveTo(this.w/2, 0);
      ctx.lineTo(this.w/2, this.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // paddles
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(this.player.x, this.player.y, this.pw, this.paddleH);
      ctx.fillRect(this.ai.x, this.ai.y, this.pw, this.paddleH);

      // ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI*2);
      ctx.fill();

      // scores
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '20px monospace';
      ctx.fillText(`${this.score.player}`, this.w*0.25, 30);
      ctx.fillText(`${this.score.ai}`, this.w*0.75, 30);
    }
    endGame(winner){
      this.stop();
      this.running = false;
      const finalScore = this.score.player;
      // update high score
      const hs = getHS('pong');
      if(finalScore > hs){ setHS('pong', finalScore); hsPong.textContent = finalScore; }
      if(this.onEnd) this.onEnd({ result: winner, score: finalScore });
    }
  }

  // --- Snake ---
  class SnakeGame {
    constructor(canvas, onEnd){
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.onEnd = onEnd;
      this.w = canvas.width; this.h = canvas.height;
      this.cell = 20;
      this.cols = Math.floor(this.w / this.cell);
      this.rows = Math.floor(this.h / this.cell);
      this.reset();
      this._bind();
      this.running = false;
    }
    reset(){
      this.snake = [{x:Math.floor(this.cols/2), y:Math.floor(this.rows/2)}];
      this.dir = {x:1,y:0};
      this.nextDir = {x:1,y:0};
      this.placeFood();
      this.stepInterval = 120; // ms
      this.accel = 0;
      this.score = 0;
      this.lastStep = 0;
    }
    placeFood(){
      let x,y,ok=false;
      while(!ok){
        x = Math.floor(Math.random()*this.cols);
        y = Math.floor(Math.random()*this.rows);
        ok = !this.snake.some(s=>s.x===x && s.y===y);
      }
      this.food = {x,y};
    }
    _bind(){
      this._onKey = (e) => {
        const k = e.key;
        if(k==='ArrowUp' || k==='w' || k==='W'){ if(this.dir.y!==1) this.nextDir = {x:0,y:-1}; }
        if(k==='ArrowDown' || k==='s' || k==='S'){ if(this.dir.y!==-1) this.nextDir = {x:0,y:1}; }
        if(k==='ArrowLeft' || k==='a' || k==='A'){ if(this.dir.x!==1) this.nextDir = {x:-1,y:0}; }
        if(k==='ArrowRight' || k==='d' || k==='D'){ if(this.dir.x!==-1) this.nextDir = {x:1,y:0}; }
      };
      window.addEventListener('keydown', this._onKey);
    }
    start(){
      this.running = true;
      this.last = performance.now();
      this._loop();
    }
    setPaused(p){
      this.paused = p;
      if(!p && !this.running){
        this.running = true;
        this.last = performance.now();
        this._loop();
      }
    }
    stop(){
      this.running = false;
      window.removeEventListener('keydown', this._onKey);
    }
    _loop(){
      if(!this.running) return;
      const now = performance.now();
      if(!this.paused && now - this.last >= this.stepInterval){
        this.last = now;
        this.step();
      }
      if(!this.paused) this.draw();
      requestAnimationFrame(()=>this._loop());
    }
    step(){
      this.dir = this.nextDir;
      const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
      // wrap-around
      if(head.x < 0) head.x = this.cols - 1;
      if(head.x >= this.cols) head.x = 0;
      if(head.y < 0) head.y = this.rows - 1;
      if(head.y >= this.rows) head.y = 0;
      // collision with body
      if(this.snake.some(p => p.x === head.x && p.y === head.y)){
        this.endGame();
        return;
      }
      this.snake.unshift(head);
      // eat
      if(head.x === this.food.x && head.y === this.food.y){
        this.score += 1;
        // speed up slightly
        this.stepInterval = Math.max(50, this.stepInterval - 2);
        this.placeFood();
      } else {
        this.snake.pop();
      }
      scoreEl.textContent = `Score: ${this.score}`;
    }
    draw(){
      const ctx = this.ctx;
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,this.w,this.h);

      // draw food
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(this.food.x*this.cell+1, this.food.y*this.cell+1, this.cell-2, this.cell-2);

      // draw snake
      ctx.fillStyle = '#39ff14';
      for(let i=0;i<this.snake.length;i++){
        const p = this.snake[i];
        ctx.fillRect(p.x*this.cell+1, p.y*this.cell+1, this.cell-2, this.cell-2);
      }
    }
    endGame(){
      this.stop();
      const finalScore = this.score;
      const hs = getHS('snake');
      if(finalScore > hs){ setHS('snake', finalScore); hsSnake.textContent = finalScore; }
      if(this.onEnd) this.onEnd({ score: finalScore });
    }
  }

  // --- Breakout ---
  class BreakoutGame {
    constructor(canvas, onEnd){
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.onEnd = onEnd;
      this.w = canvas.width; this.h = canvas.height;
      this.reset();
      this._bind();
      this.running = false;
    }
    reset(){
      this.paddle = { w: 120, h: 12, x: (this.w-120)/2, y: this.h - 40, speed: 600 };
      this.ball = { x: this.w/2, y: this.h-60, r:8, vx: 220*(Math.random()>0.5?1:-1), vy: -260 };
      this.rows = 5; this.cols = 10;
      this.brickW = Math.floor((this.w - 60) / this.cols);
      this.brickH = 20;
      this.bricks = [];
      for(let r=0;r<this.rows;r++){
        for(let c=0;c<this.cols;c++){
          this.bricks.push({x: 30 + c*(this.brickW+2), y: 40 + r*(this.brickH+6), w: this.brickW, h: this.brickH, alive: true});
        }
      }
      this.lives = 3;
      this.score = 0;
      this.mouseX = this.paddle.x;
      this.keys = {};
    }
    _bind(){
      this._onMouse = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.paddle.x = x - this.paddle.w/2;
        this.paddle.x = Math.max(0, Math.min(this.w - this.paddle.w, this.paddle.x));
      };
      this._onKey = (e) => {
        const down = e.type === 'keydown';
        if(e.key==='ArrowLeft') this.keys.left = down;
        if(e.key==='ArrowRight') this.keys.right = down;
      };
      this.canvas.addEventListener('mousemove', this._onMouse);
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('keyup', this._onKey);
    }
    start(){
      this.last = performance.now();
      this.running = true;
      this._loop();
    }
    setPaused(p){
      this.paused = p;
      if(!p && !this.running){
        this.running = true;
        this.last = performance.now();
        this._loop();
      }
    }
    stop(){
      this.running = false;
      this.canvas.removeEventListener('mousemove', this._onMouse);
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('keyup', this._onKey);
    }
    _loop(){
      if(!this.running) return;
      const now = performance.now();
      const dt = Math.min(40, now - this.last)/1000;
      this.last = now;
      if(!this.paused){
        this.update(dt);
        this.draw();
      }
      requestAnimationFrame(()=>this._loop());
    }
    update(dt){
      if(this.keys.left) this.paddle.x -= this.paddle.speed*dt;
      if(this.keys.right) this.paddle.x += this.paddle.speed*dt;
      this.paddle.x = Math.max(0, Math.min(this.w - this.paddle.w, this.paddle.x));

      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;

      // wall collisions
      if(this.ball.x - this.ball.r < 0){ this.ball.x = this.ball.r; this.ball.vx *= -1; }
      if(this.ball.x + this.ball.r > this.w){ this.ball.x = this.w - this.ball.r; this.ball.vx *= -1; }
      if(this.ball.y - this.ball.r < 0){ this.ball.y = this.ball.r; this.ball.vy *= -1; }

      // paddle collision
      if(this.ball.y + this.ball.r > this.paddle.y &&
         this.ball.x > this.paddle.x && this.ball.x < this.paddle.x + this.paddle.w &&
         this.ball.vy > 0){
        const rel = (this.ball.x - (this.paddle.x + this.paddle.w/2)) / (this.paddle.w/2);
        this.ball.vx = rel * 420;
        this.ball.vy *= -1;
        this.ball.y = this.paddle.y - this.ball.r - 1;
      }

      // bricks collisions
      for(const b of this.bricks){
        if(!b.alive) continue;
        if(this.ball.x > b.x && this.ball.x < b.x + b.w &&
           this.ball.y - this.ball.r < b.y + b.h && this.ball.y + this.ball.r > b.y){
          b.alive = false;
          this.ball.vy *= -1;
          this.score += 10;
        }
      }

      // bottom -> lose life
      if(this.ball.y - this.ball.r > this.h){
        this.lives -= 1;
        if(this.lives <= 0){
          this.endGame();
          return;
        } else {
          // reset ball & paddle
          this.paddle.x = (this.w - this.paddle.w)/2;
          this.ball.x = this.w/2; this.ball.y = this.h-60;
          this.ball.vx = 220*(Math.random()>0.5?1:-1); this.ball.vy = -260;
        }
      }

      scoreEl.textContent = `Score: ${this.score}`;

      // win
      if(this.bricks.every(b=>!b.alive)){
        this.endGame(true);
      }
    }
    draw(){
      const ctx = this.ctx;
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,this.w,this.h);

      // bricks
      for(const b of this.bricks){
        if(!b.alive) continue;
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#071022';
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      // paddle
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);

      // ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI*2);
      ctx.fill();

      // lives
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '14px monospace';
      ctx.fillText(`Lives: ${this.lives}`, 10, this.h - 10);
    }
    endGame(win=false){
      this.stop();
      const finalScore = this.score;
      const hs = getHS('breakout');
      if(finalScore > hs){ setHS('breakout', finalScore); hsBreakout.textContent = finalScore; }
      if(this.onEnd) this.onEnd({ score: finalScore, win });
    }
  }

  // Start selected game factory:
  function startGame(name){
    stopCurrentGame();
    paused = false;
    pauseBtn.textContent = 'Pause';
    if(name==='pong'){
      currentGame = new PongGame(canvas, (res) => {
        showEndMessage(`Game over — ${res.result === 'player' ? 'You win!' : 'You lost'} — Score ${res.score}`);
      });
      currentGame.start();
    } else if(name==='snake'){
      currentGame = new SnakeGame(canvas, (res) => {
        showEndMessage(`Game over — Score ${res.score}`);
      });
      currentGame.start();
    } else if(name==='breakout'){
      currentGame = new BreakoutGame(canvas, (res) => {
        showEndMessage(res.win ? `You cleared all bricks! Score ${res.score}` : `Game over — Score ${res.score}`);
      });
      currentGame.start();
    }
  }

  function showEndMessage(text){
    msgEl.textContent = text + ' — Back to home to play again.';
    msgEl.classList.remove('hidden');
  }

  // Start on home
  showHome();

  // expose for console debugging (optional)
  window._retro = { startGame: (g)=>showGame(g), showHome, getHS, setHS };

})();