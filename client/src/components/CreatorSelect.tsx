import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

type CreatorOption = {
  id: number;
  name: string;
  handle: string;
  platform?: string | null;
};

type Props = {
  value: { id: number | null; name: string; handle: string };
  onChange: (val: { id: number | null; name: string; handle: string }) => void;
  placeholder?: string;
};

export function CreatorSelect({ value, onChange, placeholder = "Search creator by name or handle" }: Props) {
  const [query, setQuery] = useState(value.name || value.handle || "");
  const [options, setOptions] = useState<CreatorOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      if (!query || query.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/creators/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        setOptions(data.results || []);
        setOpen(true);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  function handleSelect(opt: CreatorOption) {
    onChange({
      id: opt.id,
      name: opt.name,
      handle: opt.handle,
    });
    setQuery(`${opt.name} (${opt.handle})`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange({ ...value, id: null, name: e.target.value, handle: "" });
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        data-testid="input-creator-search"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-popover border border-border max-h-56 overflow-y-auto shadow-md">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
              data-testid={`option-creator-${opt.id}`}
            >
              <div className="font-medium">
                {opt.name}{" "}
                <span className="text-muted-foreground">{opt.handle}</span>
              </div>
              {opt.platform && (
                <div className="text-xs text-muted-foreground">
                  {opt.platform}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
    </div>
  );
}
