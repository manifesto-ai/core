/**
 * Vue - Schedule Form Stories
 *
 * 작업 스케줄 폼 테스트
 */

import type { Meta, StoryObj } from '@storybook/vue3'
import { h, defineComponent } from 'vue'
import { userEvent, expect } from '@storybook/test'
import { FormRenderer } from '@manifesto-ai/vue'
import {
  scheduleView,
  scheduleEntity,
  createMockFetchHandler,
  waitForFormLoad,
  waitForField,
} from '@manifesto-ai/example-schemas'

const mockFetchHandler = createMockFetchHandler()

const initialValues = {
  status: 'ACTIVE',
  missionType: 'FULFILLMENT',
  repeatType: 'DAILY',
  repeatInterval: 1,
  weekday_mon: false,
  weekday_tue: false,
  weekday_wed: false,
  weekday_thu: false,
  weekday_fri: false,
  weekday_sat: false,
  weekday_sun: false,
}

const ScheduleFormComponent = defineComponent({
  name: 'ScheduleFormComponent',
  setup() {
    const handleSubmit = (data: Record<string, unknown>) => {
      console.log('Submit data:', data)
      alert('스케줄이 저장되었습니다!\n\n' + JSON.stringify(data, null, 2))
    }

    const handleError = (error: unknown) => {
      console.error('Error:', error)
    }

    return () =>
      h('div', { style: { padding: '2rem', maxWidth: '800px', margin: '0 auto' } }, [
        h('h1', '작업 스케줄 등록'),
        h(FormRenderer, {
          schema: scheduleView,
          entitySchema: scheduleEntity,
          initialValues,
          fetchHandler: mockFetchHandler,
          debug: true,
          onSubmit: handleSubmit,
          onError: handleError,
        }),
      ])
  },
})

const meta: Meta<typeof ScheduleFormComponent> = {
  title: 'Vue/ScheduleForm',
  component: ScheduleFormComponent,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'Default Form',
}

export const WeeklySchedule: Story = {
  name: 'Weekly Schedule - Weekday Fields',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('반복 타입을 주간으로 변경', async () => {
      const repeatTypeSelect = (await waitForField(
        canvasElement,
        'repeatType'
      )) as HTMLSelectElement
      await userEvent.selectOptions(repeatTypeSelect, 'WEEKLY')
    })

    await step('요일 선택 필드 확인', async () => {
      await waitForField(canvasElement, 'weekday_mon')
      await waitForField(canvasElement, 'weekday_tue')
    })
  },
}

export const MonthlySchedule: Story = {
  name: 'Monthly Schedule - Day of Month',
  play: async ({ canvasElement, step }) => {
    await waitForFormLoad(canvasElement)

    await step('반복 타입을 월간으로 변경', async () => {
      const repeatTypeSelect = (await waitForField(
        canvasElement,
        'repeatType'
      )) as HTMLSelectElement
      await userEvent.selectOptions(repeatTypeSelect, 'MONTHLY')
    })

    await step('월간 설정 필드 확인', async () => {
      const monthDay = await waitForField(canvasElement, 'monthDay')
      expect(monthDay).toBeTruthy()
    })
  },
}
