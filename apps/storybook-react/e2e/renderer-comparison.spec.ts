/**
 * E2E Tests - Renderer Comparison
 *
 * React와 Vue 렌더러가 동일한 동작을 하는지 검증
 */

import { test, expect } from '@playwright/test'

const STORYBOOK_URL = 'http://localhost:6007'

test.describe('DeliveryRegister - React vs Vue', () => {
  test('React: default form loads correctly', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=react-deliveryregister--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('#deliveryMode')).toBeVisible()
    await expect(page.locator('#packageTier')).toBeVisible()
  })

  test('Vue: default form loads correctly', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=vue-deliveryregister--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('#deliveryMode')).toBeVisible()
    await expect(page.locator('#packageTier')).toBeVisible()
  })

  test('React: freight mode shows hazard consent', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=react-deliveryregister--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#deliveryMode', 'FREIGHT')
    await expect(page.locator('#handlingMethod')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#hazardousMaterialsConsent')).toBeVisible()
  })

  test('Vue: freight mode shows hazard consent', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=vue-deliveryregister--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#deliveryMode', 'FREIGHT')
    await expect(page.locator('#handlingMethod')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#hazardousMaterialsConsent')).toBeVisible()
  })
})

test.describe('ProductForm - React vs Vue', () => {
  test('React: digital product shows download url', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=react-productform--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#productTypeCode', 'DIGITAL')
    await expect(page.locator('#downloadUrl')).toBeVisible({ timeout: 5000 })
  })

  test('Vue: digital product shows download url', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=vue-productform--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#productTypeCode', 'DIGITAL')
    await expect(page.locator('#downloadUrl')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('ScheduleForm - React vs Vue', () => {
  test('React: weekly schedule shows weekday checkboxes', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=react-scheduleform--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#repeatType', 'WEEKLY')
    await expect(page.locator('#weekday_mon')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#weekday_tue')).toBeVisible()
  })

  test('Vue: weekly schedule shows weekday checkboxes', async ({ page }) => {
    await page.goto(`${STORYBOOK_URL}/iframe.html?id=vue-scheduleform--default`)
    await expect(page.locator('.form-renderer__content')).toBeVisible({ timeout: 15000 })

    await page.selectOption('#repeatType', 'WEEKLY')
    await expect(page.locator('#weekday_mon')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('#weekday_tue')).toBeVisible()
  })
})
