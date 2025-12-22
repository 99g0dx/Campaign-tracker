import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImportMode = "creators" | "posts";

interface ParsedRow {
  valid: boolean;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
}

interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: number;
  onImportSuccess: () => void;
}

export default function CsvImportModal({
  open,
  onClose,
  campaignId,
  onImportSuccess,
}: CsvImportModalProps) {
  const [mode, setMode] = useState<ImportMode>("creators");
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
      const result = parseCsv(text, mode);
      setParseResult(result);

      if (result.validCount === 0) {
        const headerList = result.headers.join(", ");
        const errorMsg =
          mode === "creators"
            ? `No valid creator rows found. Your CSV has columns: [${headerList}]. Make sure there's a column like 'Creator', 'Handle', 'Username', or 'Name'.`
            : `No valid post rows found. Your CSV has columns: [${headerList}]. Make sure there's a column like 'URL' or 'Post URL' with valid links starting with http.`;
        setError(errorMsg);
      }
    } catch (err) {
      setError("Failed to parse CSV file. Please check the file format.");
      console.error("CSV parse error:", err);
    }
  };

  const parseCsv = (text: string, importMode: ImportMode): ParseResult => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    // Parse header row properly using the same CSV parser
    const headerValues = parseCSVLine(lines[0]);
    const headers = headerValues.map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const rowData: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index]?.trim().replace(/^"|"$/g, "") || "";
      });

      const validation = validateRow(rowData, importMode, headers);
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

  // Helper to clean cell values - converts empty strings to undefined
  const cleanCell = (v: any): string | undefined => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === "" ? undefined : s;
  };

  // Helper to normalize creator handles - removes @ prefix
  const normalizeHandle = (v: any): string | undefined => {
    const s = cleanCell(v);
    if (!s) return undefined;
    return s.startsWith("@") ? s.slice(1).trim() : s;
  };

  const validateRow = (
    data: Record<string, any>,
    importMode: ImportMode,
    headers: string[]
  ): ParsedRow => {
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

    if (importMode === "creators") {
      // Find creator name field
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

      // Add handle to payload
      normalizedData.handle = handle;

      // Optional platform
      const platformHeader = findHeader(["platform", "network", "social"]);
      const platform = cleanCell(platformHeader ? data[platformHeader] : "");
      if (platform) {
        normalizedData.platform = platform.toLowerCase();
      }

      // Optional profile URL
      const profileHeader = findHeader([
        "profile_url",
        "profile",
        "profile link",
        "url",
      ]);
      const profileUrl = cleanCell(profileHeader ? data[profileHeader] : "");
      if (profileUrl && profileUrl.startsWith("http")) {
        normalizedData.profileUrl = profileUrl;
      }

      return { valid: true, data: normalizedData, errors, warnings };
    } else {
      // Posts mode
      const urlHeader = findHeader(["post_url", "url", "post", "link"]);
      const urlValue = urlHeader ? data[urlHeader]?.trim() : "";

      if (!urlValue || !urlValue.startsWith("http")) {
        errors.push("Missing or invalid URL");
        return { valid: false, data: normalizedData, errors, warnings };
      }

      normalizedData.url = urlValue;

      // Creator (optional but recommended)
      const creatorHeader = findHeader([
        "creator",
        "handle",
        "username",
        "user",
        "name",
      ]);
      const creatorValue = creatorHeader ? data[creatorHeader]?.trim() : "";
      normalizedData.creatorName = creatorValue
        ? creatorValue.replace(/^@/, "")
        : "Unknown";

      if (!creatorValue) {
        warnings.push("No creator name provided");
      }

      // Platform
      const platformHeader = findHeader(["platform", "network", "social"]);
      normalizedData.platform = platformHeader
        ? data[platformHeader]?.toLowerCase().trim()
        : null;

      // Optional metrics
      const parseNumber = (value: string): number => {
        if (!value) return 0;
        const cleaned = value.replace(/[,\s]/g, "");
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? 0 : num;
      };

      const viewsHeader = findHeader(["views", "view count", "view_count"]);
      const likesHeader = findHeader(["likes", "like count", "like_count"]);
      const commentsHeader = findHeader([
        "comments",
        "comment count",
        "comment_count",
      ]);
      const sharesHeader = findHeader([
        "shares",
        "share count",
        "share_count",
      ]);

      if (viewsHeader) normalizedData.views = parseNumber(data[viewsHeader]);
      if (likesHeader) normalizedData.likes = parseNumber(data[likesHeader]);
      if (commentsHeader)
        normalizedData.comments = parseNumber(data[commentsHeader]);
      if (sharesHeader) normalizedData.shares = parseNumber(data[sharesHeader]);

      return { valid: true, data: normalizedData, errors, warnings };
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.validCount === 0) return;

    setImporting(true);
    setError(null);

    try {
      const validRows = parseResult.rows.filter((r) => r.valid).map((r) => r.data);

      const response = await fetch(`/api/campaigns/${campaignId}/import-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          rows: validRows,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Import failed");
      }

      const result = await response.json();

      toast({
        title: "Import successful",
        description:
          mode === "creators"
            ? `Imported ${result.imported} creator${result.imported !== 1 ? "s" : ""}`
            : `Imported ${result.imported} post${result.imported !== 1 ? "s" : ""}`,
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

  const handleClose = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    setMode("creators");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Import creators or posts from a CSV file
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="creators">Creators List</TabsTrigger>
            <TabsTrigger value="posts">Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="creators" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required:</strong> Creator, Handle, Username, or Name
                <br />
                <strong>Optional:</strong> Platform, Profile URL
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="posts" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required:</strong> URL or Post URL (must start with http)
                <br />
                <strong>Optional:</strong> Creator, Platform, Views, Likes, Comments,
                Shares
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
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
                    ` and ${parseResult.invalidCount} invalid row${parseResult.invalidCount !== 1 ? "s" : ""}`}
                </AlertDescription>
              </Alert>

              <div>
                <h3 className="text-sm font-medium mb-2">
                  Preview (first 10 rows)
                </h3>
                <div className="border rounded-md overflow-auto max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Status</TableHead>
                        {mode === "creators" ? (
                          <>
                            <TableHead>Handle</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Profile URL</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>URL</TableHead>
                            <TableHead>Creator</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Metrics</TableHead>
                          </>
                        )}
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.rows.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {row.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </TableCell>
                          {mode === "creators" ? (
                            <>
                              <TableCell className="font-mono text-sm">
                                {row.data.handle || "-"}
                              </TableCell>
                              <TableCell>{row.data.platform || "-"}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {row.data.profileUrl || "-"}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="max-w-xs truncate font-mono text-xs">
                                {row.data.url || "-"}
                              </TableCell>
                              <TableCell>{row.data.creatorName || "-"}</TableCell>
                              <TableCell>{row.data.platform || "-"}</TableCell>
                              <TableCell className="text-xs">
                                {row.data.views ? `${row.data.views} views` : ""}
                                {row.data.likes ? `, ${row.data.likes} likes` : ""}
                              </TableCell>
                            </>
                          )}
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
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={importing}>
                  {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Import {parseResult.validCount} Row
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
