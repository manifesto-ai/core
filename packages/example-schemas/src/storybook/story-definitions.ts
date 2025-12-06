/**
 * Shared Story Definitions
 *
 * React와 Vue Storybook에서 공유하는 스토리 메타데이터
 */

import {
  productEntity,
  productCreateView,
  deliveryRegisterEntity,
  deliveryRegisterView,
  scheduleEntity,
  scheduleView,
} from '../index'

/**
 * 스토리 정의 타입
 */
export interface StoryDefinition<T = Record<string, unknown>> {
  title: string
  description: string
  schema: unknown
  entitySchema: unknown
  initialValues: T
  variants?: Record<string, { initialValues?: Partial<T>; description?: string }>
}

/**
 * ProductForm 스토리 정의
 */
export const productFormStory: StoryDefinition = {
  title: 'Form/ProductForm',
  description: '상품 등록 폼',
  schema: productCreateView,
  entitySchema: productEntity,
  initialValues: {
    status: 'DRAFT',
    productTypeCode: 'PHYSICAL',
    fulfillmentTypeCode: 'STANDARD',
    discountRate: 0,
    stockQuantity: 0,
  },
  variants: {
    Default: {
      description: 'Default Form',
    },
    PhysicalProduct: {
      initialValues: { productTypeCode: 'PHYSICAL' },
      description: 'Physical Product - Stock Fields',
    },
    DigitalProduct: {
      initialValues: { productTypeCode: 'DIGITAL' },
      description: 'Digital Product - Hidden Shipping Fields',
    },
  },
}

/**
 * DeliveryRegister 스토리 정의
 */
export const deliveryRegisterStory: StoryDefinition = {
  title: 'Form/DeliveryRegister',
  description: '배송 등록 폼',
  schema: deliveryRegisterView,
  entitySchema: deliveryRegisterEntity,
  initialValues: {
    status: 'DRAFT',
    weatherProof: false,
    hazardousMaterialsConsent: false,
    needsSignature: true,
    customerNotification: true,
  },
  variants: {
    Default: {
      description: 'Default Form',
    },
    WeatherProofEnabled: {
      initialValues: { weatherProof: true },
      description: 'Weather Proof Options Visible',
    },
    HazardousMaterials: {
      initialValues: { hazardousMaterialsConsent: true },
      description: 'Hazardous Materials Fields Visible',
    },
  },
}

/**
 * ScheduleForm 스토리 정의
 */
export const scheduleFormStory: StoryDefinition = {
  title: 'Form/ScheduleForm',
  description: '스케줄 폼',
  schema: scheduleView,
  entitySchema: scheduleEntity,
  initialValues: {
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
    monthDay: 1,
  },
  variants: {
    Default: {
      description: 'Default Form (Daily)',
    },
    DailyRepeat: {
      initialValues: { repeatType: 'DAILY' },
      description: 'Daily Repeat - Shows Interval Field',
    },
    WeeklyRepeat: {
      initialValues: { repeatType: 'WEEKLY' },
      description: 'Weekly Repeat - Shows Weekday Checkboxes',
    },
    MonthlyRepeat: {
      initialValues: { repeatType: 'MONTHLY' },
      description: 'Monthly Repeat - Shows Month Day Field',
    },
  },
}

/**
 * 모든 스토리 정의 모음
 */
export const storyDefinitions = {
  productForm: productFormStory,
  deliveryRegister: deliveryRegisterStory,
  scheduleForm: scheduleFormStory,
} as const
