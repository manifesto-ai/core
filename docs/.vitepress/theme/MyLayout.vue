<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HeroBackground from './components/HeroBackground.vue'
import HeroTaglineTyper from './components/HeroTaglineTyper.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <HeroBackground />
    </template>
    <template #home-hero-info-after>
      <HeroTaglineTyper />
    </template>
  </Layout>
</template>
