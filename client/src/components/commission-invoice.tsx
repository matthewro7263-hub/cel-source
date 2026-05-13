// v4 Commission line items + Invoice generator
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FileDown, Receipt } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LineItem {
  id: number;
  commissionId: number;
  description: string;
  quantity: number;
  unitPriceCents: number;
  createdAt: string;
}

interface CommissionInvoiceProps {
  commissionId: number;
  clientName: string;
  clientEmail: string;
}

function centsToDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CommissionLineItemsEditor({ commissionId, clientName, clientEmail }: CommissionInvoiceProps) {
  const { data: lineItems = [], isLoading } = useQuery<LineItem[]>({
    queryKey: ["/api/commissions", commissionId, "line-items"],
    queryFn: async () => (await apiRequest("GET", `/api/commissions/${commissionId}/line-items`)).json(),
  });
  const { user } = useAuth();
  const { toast } = useToast();

  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newUnit, setNewUnit] = useState(0);

  const addItem = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", `/api/commissions/${commissionId}/line-items`, {
        description: newDesc,
        quantity: newQty,
        unitPriceCents: Math.round(newUnit * 100),
      })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions", commissionId, "line-items"] });
      setNewDesc(""); setNewQty(1); setNewUnit(0);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/commission-line-items/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/commissions", commissionId, "line-items"] }),
  });

  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);

  const generateInvoice = async () => {
    try {
      // Dynamic import to keep bundle small
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const artistName = user?.name ?? "Artist";
      const artistColor = user?.avatarColor ?? "#6E4FE8";

      // Header band
      doc.setFillColor(artistColor);
      doc.rect(0, 0, 210, 32, "F");

      // Artist name in header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(artistName, 15, 18);

      // INVOICE label
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("INVOICE", 195, 18, { align: "right" });

      // Reset text color
      doc.setTextColor(30, 30, 30);

      // Invoice info
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Invoice To:", 15, 44);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 15, 50);
      doc.text(clientEmail, 15, 56);

      // Date
      const now = new Date().toLocaleDateString();
      doc.setFont("helvetica", "bold");
      doc.text("Date:", 145, 44);
      doc.setFont("helvetica", "normal");
      doc.text(now, 145, 50);

      // Separator
      doc.setDrawColor(220, 220, 220);
      doc.line(15, 64, 195, 64);

      // Line items table header
      let y = 72;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Description", 15, y);
      doc.text("Qty", 130, y, { align: "right" });
      doc.text("Unit Price", 160, y, { align: "right" });
      doc.text("Total", 195, y, { align: "right" });

      doc.setDrawColor(200, 200, 200);
      doc.line(15, y + 2, 195, y + 2);
      y += 8;

      // Line items
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const item of lineItems) {
        const lineTot = item.quantity * item.unitPriceCents;
        doc.text(item.description, 15, y);
        doc.text(String(item.quantity), 130, y, { align: "right" });
        doc.text(centsToDisplay(item.unitPriceCents), 160, y, { align: "right" });
        doc.text(centsToDisplay(lineTot), 195, y, { align: "right" });
        y += 7;
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
      }

      // Total
      doc.line(140, y + 2, 195, y + 2);
      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL", 140, y);
      doc.text(centsToDisplay(total), 195, y, { align: "right" });

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("Thank you for your business!", 105, 280, { align: "center" });

      const safeClient = clientName.replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`Invoice-${commissionId}-${safeClient}.pdf`);
      toast({ title: "Invoice downloaded!" });
    } catch (e: any) {
      toast({ title: "Error generating invoice", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5"><Receipt size={14} />Line Items</h4>
        {lineItems.length > 0 && (
          <Button size="sm" variant="outline" onClick={generateInvoice} data-testid="button-generate-invoice" className="gap-1.5">
            <FileDown size={13} />Generate invoice PDF
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-16 bg-muted rounded animate-pulse" />
      ) : (
        <>
          {lineItems.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-right px-3 py-2 font-medium w-16">Qty</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Unit price</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-t border-border" data-testid={`line-item-${item.id}`}>
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{centsToDisplay(item.unitPriceCents)}</td>
                      <td className="px-3 py-2 text-right font-medium">{centsToDisplay(item.quantity * item.unitPriceCents)}</td>
                      <td className="px-2 py-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => deleteItem.mutate(item.id)}
                          data-testid={`button-delete-line-item-${item.id}`}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-right">Total</td>
                    <td className="px-3 py-2 text-right font-bold">{centsToDisplay(total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Add line item */}
          <div className="grid grid-cols-[1fr_64px_96px_auto] gap-2 items-end">
            <div>
              <Label className="text-xs mb-1">Description</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="e.g. Half-body character"
                className="h-8 text-sm"
                data-testid="input-line-item-description"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">Qty</Label>
              <Input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
                data-testid="input-line-item-qty"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">Unit ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={newUnit}
                onChange={(e) => setNewUnit(parseFloat(e.target.value) || 0)}
                className="h-8 text-sm"
                data-testid="input-line-item-unit-price"
              />
            </div>
            <Button
              size="sm"
              className="h-8"
              onClick={() => addItem.mutate()}
              disabled={!newDesc.trim() || addItem.isPending}
              data-testid="button-add-line-item"
            >
              <Plus size={13} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
