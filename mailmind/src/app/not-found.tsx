import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl p-6 pt-24">
      <EmptyState
        icon={FileQuestion}
        title="Seite nicht gefunden"
        description="Die angeforderte Seite existiert nicht oder wurde verschoben."
        action={
          <Button asChild>
            <Link href="/dashboard">Zum Dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
