// The app's icons, all from lucide-react. Names are kept so call sites read
// the same; the size comes from the className (`size-4` by default).
import {
  Check,
  ChevronDown as LucideChevronDown,
  ChevronRight as LucideChevronRight,
  ChevronsUpDown as LucideChevronsUpDown,
  Clock,
  CodeXml,
  Coins,
  Columns2,
  Copy,
  Ellipsis,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderRoot,
  FolderSearch,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Trash2,
  Type,
  X,
} from "lucide-react";
import type { ComponentType } from "react";

type P = { className?: string };

function icon(Glyph: ComponentType<{ className?: string; "aria-hidden"?: boolean }>) {
  return ({ className = "size-4" }: P) => <Glyph className={className} aria-hidden />;
}

export const ChevronRight = icon(LucideChevronRight);
export const ChevronDown = icon(LucideChevronDown);
export const ChevronsUpDown = icon(LucideChevronsUpDown);
export const FolderIcon = icon(Folder);
export const FolderOpenIcon = icon(FolderOpen);
export const FolderRootIcon = icon(FolderRoot);
export const FolderSearchIcon = icon(FolderSearch);
export const FolderPlusIcon = icon(FolderPlus);
export const FileTextIcon = icon(FileText);
export const PlusIcon = icon(Plus);
export const SearchGlyph = icon(Search);
export const EllipsisIcon = icon(Ellipsis);
export const TrashGlyph = icon(Trash2);
export const TypeIcon = icon(Type);
export const CopyIcon = icon(Copy);
export const ClockIcon = icon(Clock);
export const CodeXmlIcon = icon(CodeXml);
export const Columns2Icon = icon(Columns2);
export const SettingsIcon = icon(SlidersHorizontal);
export const XIcon = icon(X);
export const RefreshGlyph = icon(RefreshCw);
export const RevealGlyph = icon(SquareArrowOutUpRight);
export const CheckIcon = icon(Check);
export const CoinsIcon = icon(Coins);
