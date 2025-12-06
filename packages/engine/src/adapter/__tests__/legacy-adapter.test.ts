/**
 * Legacy Adapter Tests
 */

import { describe, it, expect } from 'vitest'
import {
  LegacyAdapter,
  createLegacyAdapter,
  transformRequest,
  transformResponse,
  adapterPresets,
} from '../legacy-adapter'
import type { AdapterConfig } from '@manifesto-ai/schema'

describe('LegacyAdapter', () => {
  describe('transformRequest', () => {
    it('should pass through data without transform config', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = { type: 'legacy' }
      const data = { name: 'John', age: 30 }

      const result = adapter.transformRequest(data, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual(data)
      }
    })

    it('should transform request data using pipeline', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'mapToLegacy',
              operation: 'rename',
              config: {
                renames: {
                  firstName: 'first_name',
                  lastName: 'last_name',
                },
              },
            },
          ],
        },
      }

      const result = adapter.transformRequest(
        { firstName: 'John', lastName: 'Doe' },
        config
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          first_name: 'John',
          last_name: 'Doe',
        })
      }
    })
  })

  describe('transformResponse', () => {
    it('should pass through data without transform config', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = { type: 'legacy' }
      const data = { name: 'John', age: 30 }

      const result = adapter.transformResponse(data, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual(data)
      }
    })

    it('should transform response data using pipeline', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'mapFromLegacy',
              operation: 'rename',
              config: {
                renames: {
                  first_name: 'firstName',
                  last_name: 'lastName',
                },
              },
            },
          ],
        },
      }

      const result = adapter.transformResponse(
        { first_name: 'John', last_name: 'Doe' },
        config
      )

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          firstName: 'John',
          lastName: 'Doe',
        })
      }
    })

    it('should parse JSON string response when not looking like XML', () => {
      const adapter = createLegacyAdapter()
      // graphql type은 XML 파싱을 시도하지 않음
      const config: AdapterConfig = { type: 'graphql' }
      const jsonString = '{"name":"John","age":30}'

      const result = adapter.transformResponse(jsonString, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'John', age: 30 })
      }
    })

    it('should parse simple XML response', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = { type: 'legacy' }
      const xmlString = '<root><name>John</name><age>30</age></root>'

      const result = adapter.transformResponse(xmlString, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        // XML 파서가 root 태그 내부를 파싱하므로 name, age 필드를 가짐
        expect(result.value).toHaveProperty('name')
        expect(result.value).toHaveProperty('age')
      }
    })
  })

  describe('convenience functions', () => {
    it('transformRequest should work as standalone function', () => {
      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'pick',
              operation: 'pick',
              config: { keys: ['name'] },
            },
          ],
        },
      }

      const result = transformRequest({ name: 'John', extra: 'data' }, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'John' })
      }
    })

    it('transformResponse should work as standalone function', () => {
      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'default',
              operation: 'default',
              config: { defaults: { status: 'active' } },
            },
          ],
        },
      }

      const result = transformResponse({ name: 'John' }, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({ name: 'John', status: 'active' })
      }
    })
  })

  describe('adapterPresets', () => {
    it('soap preset should configure SOAP adapter', () => {
      const config = adapterPresets.soap('Body.Response')

      expect(config.type).toBe('soap')
      expect(config.responseTransform).toBeDefined()
    })

    it('legacyErp preset should configure field mappings', () => {
      const config = adapterPresets.legacyErp({
        product_name: 'name',
        product_price: 'price',
      })

      expect(config.type).toBe('legacy')
      expect(config.responseTransform?.steps).toHaveLength(1)
    })

    it('graphql preset should configure GraphQL adapter', () => {
      const config = adapterPresets.graphql('data.user')

      expect(config.type).toBe('graphql')
      expect(config.responseTransform).toBeDefined()
    })
  })

  describe('complex transform scenarios', () => {
    it('should handle legacy ERP response transformation', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'map',
              operation: 'map',
              config: {
                mappings: {
                  id: 'PROD_ID',
                  name: 'PROD_NAME',
                  price: 'PROD_PRICE',
                  stock: 'INVENTORY.QTY',
                },
              },
            },
            {
              _step: 'transform',
              id: 'cast',
              operation: 'cast',
              config: {
                casts: {
                  price: 'number',
                  stock: 'number',
                },
              },
            },
          ],
        },
      }

      const legacyResponse = {
        PROD_ID: 'P001',
        PROD_NAME: 'Widget',
        PROD_PRICE: '99.99',
        INVENTORY: { QTY: '100' },
        LEGACY_FIELD: 'ignored',
      }

      const result = adapter.transformResponse(legacyResponse, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          id: 'P001',
          name: 'Widget',
          price: 99.99,
          stock: 100,
        })
      }
    })

    it('should handle request transformation for legacy API', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: {
          steps: [
            {
              _step: 'transform',
              id: 'flatten',
              operation: 'flatten',
              config: { delimiter: '_' },
            },
            {
              _step: 'transform',
              id: 'rename',
              operation: 'rename',
              config: {
                renames: {
                  product_name: 'PROD_NAME',
                  product_price: 'PROD_PRICE',
                  product_category_id: 'CAT_ID',
                },
              },
            },
          ],
        },
      }

      const uiData = {
        product: {
          name: 'Widget',
          price: 99.99,
          category: { id: 'CAT001' },
        },
      }

      const result = adapter.transformRequest(uiData, config)

      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toEqual({
          PROD_NAME: 'Widget',
          PROD_PRICE: 99.99,
          CAT_ID: 'CAT001',
        })
      }
    })
  })

  describe('debug mode', () => {
    it('should log debug information when enabled', () => {
      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args) => logs.push(args.join(' '))

      const adapter = createLegacyAdapter({ debug: true })
      const config: AdapterConfig = { type: 'legacy' }

      adapter.transformRequest({ test: 'data' }, config)

      console.log = originalLog

      expect(logs.some((log) => log.includes('transformRequest'))).toBe(true)
    })
  })

  describe('error and parsing branches', () => {
    it('returns TRANSFORM_ERROR when request pipeline fails', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        requestTransform: { steps: [{ _step: 'transform', id: 'bad', operation: 'unknown', config: {} }] },
      }

      const result = adapter.transformRequest({ foo: 'bar' }, config)
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('TRANSFORM_ERROR')
        expect(result.error.phase).toBe('request')
      }
    })

    it('returns TRANSFORM_ERROR when response pipeline fails', () => {
      const adapter = createLegacyAdapter()
      const config: AdapterConfig = {
        type: 'legacy',
        responseTransform: { steps: [{ _step: 'transform', id: 'bad', operation: 'unknown', config: {} }] },
      }

      const result = adapter.transformResponse({ foo: 'bar' }, config)
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.phase).toBe('response')
      }
    })

    it('parses empty strings and JSON fallbacks', () => {
      const adapter = createLegacyAdapter()
      const emptyResult = adapter.transformResponse('', { type: 'legacy' })
      expect(emptyResult._tag).toBe('Ok')
      if (emptyResult._tag === 'Ok') {
        expect(emptyResult.value).toEqual({})
      }

      const jsonResult = adapter.transformResponse('{"a":1}', { type: 'legacy' })
      expect(jsonResult._tag).toBe('Ok')
      if (jsonResult._tag === 'Ok') {
        expect(jsonResult.value).toEqual({ a: 1 })
      }

      const fallbackResult = adapter.transformResponse('not json', { type: 'legacy' })
      expect(fallbackResult._tag).toBe('Ok')
      if (fallbackResult._tag === 'Ok') {
        expect(fallbackResult.value).toBe('not json')
      }
    })

    it('handles GraphQL parse failures gracefully', () => {
      const adapter = createLegacyAdapter()
      const result = adapter.transformResponse('invalid json', { type: 'graphql' })
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toBe('invalid json')
      }
    })

    it('returns PARSE_ERROR when XML parsing fails', () => {
      const adapter = createLegacyAdapter({
        xmlParser: () => {
          throw new Error('bad xml')
        },
      })

      const result = adapter.transformResponse('<root><bad></root>', { type: 'legacy' })
      expect(result._tag).toBe('Err')
      if (result._tag === 'Err') {
        expect(result.error.type).toBe('PARSE_ERROR')
      }
    })

    it('extracts SOAP body when present', () => {
      const adapter = createLegacyAdapter()
      const soapXml =
        '<soap:Envelope><soap:Body><Response><Value>42</Value></Response></soap:Body></soap:Envelope>'

      const result = adapter.transformResponse(soapXml, { type: 'soap' })
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(result.value).toHaveProperty('Value', '42')
      }
    })

    it('creates arrays for repeated XML tags', () => {
      const adapter = createLegacyAdapter()
      const xml = '<root><item>A</item><item>B</item></root>'

      const result = adapter.transformResponse(xml, { type: 'legacy' })
      expect(result._tag).toBe('Ok')
      if (result._tag === 'Ok') {
        expect(Array.isArray((result.value as any).item)).toBe(true)
      }
    })

    it('runs transform functions inside presets', () => {
      const soap = adapterPresets.soap('Envelope.Body.Payload')
      const extractSoap = (soap.responseTransform!.steps[0] as any).config.transform as (data: unknown) => unknown
      expect(extractSoap({ Envelope: { Body: { Payload: { id: 1 } } } })).toEqual({ id: 1 })

      const graphql = adapterPresets.graphql('data.user')
      const extractGraphql = (graphql.responseTransform!.steps[0] as any).config.transform as (data: unknown) => unknown
      expect(extractGraphql({ data: { user: { name: 'Jane' } } })).toEqual({ name: 'Jane' })
    })

    it('logs debug information on transformResponse when enabled', () => {
      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args) => logs.push(args.join(' '))

      const adapter = createLegacyAdapter({ debug: true })
      adapter.transformResponse({ ok: true }, { type: 'legacy' })

      console.log = originalLog
      expect(logs.some((log) => log.includes('transformResponse'))).toBe(true)
    })
  })
})
