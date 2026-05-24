/**
 * Dialog — accessible modal (Radix-based).
 *
 * @example
 * <Dialog>
 *   <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>Delete subscription?</DialogTitle>
 *       <DialogDescription>This cannot be undone.</DialogDescription>
 *     </DialogHeader>
 *     <DialogFooter>
 *       <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
 *       <Button variant="danger">Delete</Button>
 *     </DialogFooter>
 *   </DialogContent>
 * </Dialog>
 */
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Hide the default close (X) button in the corner */
    hideClose?: boolean;
  }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // ── Mobile (default): bottom sheet — slides up from viewport bottom,
        //    full-width, top-rounded only. Touch zone is the entire screen.
        //    Max height capped so long content scrolls inside the sheet.
        "fixed inset-x-0 bottom-0 z-50 grid w-full",
        "max-h-[90vh] overflow-y-auto",
        "gap-4 border-t border-hairline bg-paper p-5 pb-6 shadow-2xl",
        "rounded-t-2xl",
        // Safe-area for iPhone notch / Android gesture bar
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        // Mobile open/close: slide up from bottom
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",

        // ── Desktop (md+): centered modal — original behaviour.
        "md:fixed md:left-1/2 md:top-1/2 md:inset-x-auto md:bottom-auto",
        "md:max-w-lg md:max-h-[85vh] md:-translate-x-1/2 md:-translate-y-1/2",
        "md:rounded-lg md:border md:p-6",
        "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
        "md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]",
        "md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
        // Reset mobile-only slides on desktop
        "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0",
        className
      )}
      {...props}
    >
      {/* Drag handle (mobile only — visual affordance that the sheet is dismissible) */}
      <div className="md:hidden mx-auto -mt-1 mb-2 h-1.5 w-12 rounded-full bg-hairline" aria-hidden />
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className={cn(
            "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2",
            "disabled:pointer-events-none"
          )}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-1 text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-serif text-xl leading-tight text-ink", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ink-3 leading-relaxed", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
