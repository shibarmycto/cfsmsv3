import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MobileInfoModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function MobileInfoModal({ isOpen, title, message, onClose }: MobileInfoModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative w-full max-w-lg border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
