<script setup lang="ts">
import GameView from './views/GameView.vue'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>🎮 自动弹射对决</h1>
    </header>
    
    <main>
      <GameView />
    </main>
    
    <footer class="app-footer">
      <p>基于Vue3和Matter.js开发</p>
    </footer>
  </div>
</template>

<style>
:root {
  --primary-color: #4CAF50;
  --secondary-color: #2196F3;
  --background-color: #121212;
  --surface-color: #1e1e1e;
  --text-color: #ffffff;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Arial', sans-serif;
  background-color: var(--background-color);
  color: var(--text-color);
  line-height: 1.6;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  text-align: center;
  padding: 1rem;
  background-color: var(--surface-color);
  border-bottom: 2px solid var(--primary-color);
}

main {
  flex: 1;
  padding: 1rem;
}

.app-footer {
  text-align: center;
  padding: 1rem;
  background-color: var(--surface-color);
  border-top: 1px solid #333;
  font-size: 0.9rem;
  opacity: 0.8;
}
</style>
