import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#50080E] text-[#F2F1ED] shadow-[0_8px_24px_rgba(80,8,14,0.18)] hover:-translate-y-0.5 hover:bg-[#72383D] hover:shadow-[0_12px_32px_rgba(80,8,14,0.24)]",
        gold:
          "gold-gradient text-[#50080E] font-bold shadow-[0_8px_24px_rgba(212,175,55,0.24)] hover:-translate-y-0.5 hover:brightness-105",
        secondary:
          "border border-[#DCCDCE]/50 bg-[#F5F4F1] text-[#50080E] shadow-luxury-sm hover:bg-[#DCCDCE]/20",
        ghost: "text-[#50080E] hover:bg-[#50080E]/5",
        outline:
          "border border-[#DCCDCE]/60 bg-transparent text-[#50080E] hover:bg-[#50080E]/5 hover:border-[#50080E]/20",
        glass:
          "border border-[#DCCDCE]/30 bg-[var(--glass)] text-[#50080E] shadow-luxury-sm backdrop-blur-2xl hover:border-[#D4AF37]/30 hover:bg-[var(--glass-strong)]",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
