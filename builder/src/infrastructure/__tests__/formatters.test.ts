import { formatBytes } from "../utils/formatters"

describe('formatBytes', () => {
   it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(1024)).toBe('1.0 KB')
      expect(formatBytes(1536)).toBe('1.5 KB')
      expect(formatBytes(1048576)).toBe('1.0 MB')
      expect(formatBytes(2621440)).toBe('2.5 MB')
   })
})