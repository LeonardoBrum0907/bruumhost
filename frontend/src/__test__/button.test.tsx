import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Button } from "@/components/ui/button"
import userEvent from "@testing-library/user-event"

describe('Button', () => {
   it('should render button with text',  () => {
      render(<Button>Deploy</Button>)
      
      const button = screen.getByText('Deploy')

      expect(button).toBeInTheDocument()
   })

   it('should call onClick when clicked', async () => {
      const handleClick = vi.fn()

      render(<Button onClick={handleClick}>Deploy</Button>)

      const button = screen.getByText('Deploy')

      await userEvent.click(button)

      expect(handleClick).toHaveBeenCalledTimes(1)
   })

   it('should not call onClick when disabled', async () => {
      const handleClick = vi.fn()

      render(<Button disabled onClick={handleClick}>Deploy</Button>)

      const button = screen.getByText('Deploy')
      await userEvent.click(button)

      expect(handleClick).not.toHaveBeenCalled()
   })

   it('should apply custom className', () => {
      render(<Button className="custom-class">Deploy</Button>)

      const button = screen.getByText('Deploy')

      expect(button).toHaveClass('custom-class')
   })
})