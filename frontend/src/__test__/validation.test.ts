import { isValidURL } from "@/utils/validations";
import { describe, expect, it } from "vitest";
import { faker } from "@faker-js/faker";

describe('isValidGithubURL - Github URL Validation', () => {
   it('should validate full Github URL with https', () => {
      expect(isValidURL('https://github.com/user/repo')).toBe(true)
   })

   it('should validate URL with www', () => {
      expect(isValidURL('https://www.github.com/user/repo')).toBe(true)
   })

   it('should validate URL with trailing slash', () => {
      expect(isValidURL('https://github.com/user/repo/')).toBe(true)
   })

   it('should accept URLs with special characters in repository name', () => {
      expect(isValidURL('https://github.com/user/repo-name-with-special-chars')).toBe(true)
   })

   it('should validate URL without https://', () => {
      expect(isValidURL('github.com/user/repo')).toBe(false)
   })

   it('should reject URL without user', () => {
      expect(isValidURL('https://github.com/repo')).toBe(false)
   })

   it('should reject URLs from sites other than github.com', () => {
      expect(isValidURL(faker.internet.url() + '/user/repo')).toBe(false)
   })

   it('should reject empty string', () => {
      expect(isValidURL('')).toBe(false)
   })

   it('should reject invalid URL', () => {
      expect(isValidURL('https://github.com/user/repo/invalid')).toBe(false)
      expect(isValidURL('github.com')).toBe(false)
      expect(isValidURL('https://github.com')).toBe(false)
   })
})