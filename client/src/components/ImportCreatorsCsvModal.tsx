import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedCreatorRow {
  valid: boolean;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
}

interface ParseResult {
  headers: string[];
  rows: ParsedCreatorRow[];
  validCount: number;
  invalidCount: number;
}

interface ImportCreatorsCsvModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: number;
  onImportSuccess: () => void;
}

// Example CSV data for download
const EXAMPLE_CSV = `creator,platform,posts_promised
@johndoe,tiktok,5
jane.smith,instagram,3
alex_creator,youtube,2
creator_handle,x,1`;

export default function ImportCreatorsCsvModal({
  open,
  onClose,
  campaignId,
  onImportSuccess,
}: ImportCreatorsCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setParseResult(null);

    try {
      const text = await selectedFile.text();
      const result = parseCsv(text);
      setParseResult(result);

      if (result.validCount === 0) {
        const headerList = result.headers.join(", ");
        setError(
          `No valid creator rows found. Your CSV has columns: [${headerList}]. Make sure there's a column like 'Creator', 'Handle', 'Username', or 'Name'.`
        );
      }
    } catch (err) {
      setError("Failed to parse CSV file. Please check the file format.");
      console.error("CSV parse error:", err);
    }
  };

  const parseCsv = (text: string): ParseResult => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse header row
    const headerValues = parseCSVLine(lines[0]);
    const headers = headerValues.map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows: ParsedCreatorRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.trim().replace(/^"|"$/g, "") || "";
      });

      const validation = validateCreatorRow(rowData, headers);
      rows.push(validation);
    }

    const validCount = rows.filter((r) => r.valid).length;
    return {
      headers,
      rows,
      validCount,
      invalidCount: rows.length - validCount,
    };
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const cleanCell = (v: any): string | undefined => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  };

  const normalizeHandle = (v: any): string | undefined => {
    const s = cleanCell(v);
    if (!s) return undefined;
    // Remove leading @ if present
    return s.startsWith("@") ? s.slice(1).trim() : s;
  };

  const validateCreatorRow = (
    data: Record<string, any>,
    headers: string[]
  ): ParsedCreatorRow => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedData: Record<string, any> = {};

    // Helper to find header by aliases (case-insensitive)
    const findHeader = (aliases: string[]): string | null => {
      const lowerHeaders = headers.map((h) => h.toLowerCase());
      for (const alias of aliases) {
        const index = lowerHeaders.indexOf(alias.toLowerCase());
        if (index !== -1) return headers[index];
      }
      return null;
    };

    // Find creator name field (required)
    const creatorHeader = findHeader([
      "creator",
      "handle",
      "username",
      "user",
      "name",
    ]);
    const creatorValue = creatorHeader ? data[creatorHeader] : "";
    const handle = normalizeHandle(creatorValue);

    if (!handle) {
      errors.push("Missing creator name/handle");
      return { valid: false, data: normalizedData, errors, warnings };
    }

    normalizedData.handle = handle;

    // Optional platform
    const platformHeader = findHeader(["platform", "network", "social"]);
    const platform = cleanCell(platformHeader ? data[platformHeader] : "");
    if (platform) {
      normalizedData.platform = platform.toLowerCase();
    } else {
      normalizedData.platform = "unknown";
      warnings.push("Platform not specified, defaulting to 'unknown'");
    }

    // Optional posts_promised (integer, >= 1)
    const postsPromisedHeader = findHeader([
      "posts_promised",
      "posts promised",
      "posts",
      "promised_posts",
    ]);
    const postsPromisedValue = cleanCell(
      postsPromisedHeader ? data[postsPromisedHeader] : ""
    );
    if (postsPromisedValue) {
      const num = parseInt(postsPromisedValue, 10);
      if (isNaN(num) || num < 1) {
        warnings.push(
          `Invalid posts_promised value '${postsPromisedValue}', defaulting to 1`
        );
        normalizedData.posts_promised = 1;
      } else {
        normalizedData.posts_promised = num;
      }
    } else {
      normalizedData.posts_promised = 1;
    }

    return { valid: true, data: normalizedData, errors, warnings };
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.validCount === 0) return;

    setImporting(true);
    setError(null);

    try {
      const validRows = parseResult.rows
        .filter((r) => r.valid)
        .map((r) => r.data);

      const response = await fetch(
        `/api/campaigns/${campaignId}/import-creators-csv`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: validRows,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Import failed");
      }

      const result = await response.json();

      toast({
        title: "Import successful",
        description: `Added ${result.added} creator${result.added !== 1 ? "s" : ""}${
          result.skipped > 0 ? `, skipped ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""}` : ""
        }`,
      });

      onImportSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to import CSV");
      toast({
        title: "Import failed",
        description: err.message || "Please check your CSV and try again",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadExampleCsv = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(EXAMPLE_CSV)
    );
    element.setAttribute("download", "creators_template.csv");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Creators CSV</DialogTitle>
          <DialogDescription>
            Bulk add creators to your campaign. Creators will be added with status "Pending" since
            no post links are included at import time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <strong>Required column:</strong> Creator, Handle, Username, or Name
                </div>
                <div>
                  <strong>Optional columns:</strong> Platform (default: unknown), Posts Promised
                  (default: 1)
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Handles will be normalized (@ prefix removed, spaces trimmed). No URL/link column
                  needed.
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadExampleCsv}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div>
            <Label htmlFor="csv-file">Upload CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="cursor-pointer"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {parseResult && parseResult.validCount > 0 && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Found {parseResult.validCount} valid row
                  {parseResult.validCount !== 1 ? "s" : ""}
                  {parseResult.invalidCount > 0 &&
                    ` and ${parseResult.invalidCount} invalid row${
                      parseResult.invalidCount !== 1 ? "s" : ""
                    }`}
                </AlertDescription>
              </Alert>

              <div>
                <h3 className="text-sm font-medium mb-2">
                  Preview (first 20 rows)
                </h3>
                <div className="border rounded-md overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Posts Promised</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.rows.slice(0, 20).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {row.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {row.data.handle || "-"}
                          </TableCell>
                          <TableCell>
                            {row.data.platform || "-"}
                          </TableCell>
                          <TableCell>
                            {row.data.posts_promised || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {row.errors.map((err, i) => (
                                <div key={i} className="text-red-600">
                                  {err}
                                </div>
                              ))}
                              {row.warnings.map((warn, i) => (
                                <div key={i} className="text-yellow-600">
                                  {warn}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parseResult.rows.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing 20 of {parseResult.rows.length} total rows
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {parseResult.validCount} Creator
                  {parseResult.validCount !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
