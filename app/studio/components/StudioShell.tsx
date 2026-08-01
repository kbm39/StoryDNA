import Link from "next/link";

const NAV = [
  { href: "/studio/books", label: "Library" },
] as const;

export function StudioNav({ bookId }: { bookId?: string }) {
  const bookLinks = bookId
    ? [
        { href: `/studio/books/${bookId}`, label: "Book Workspace" },
        { href: `/studio/books/${bookId}/intent`, label: "Author Intent" },
        { href: `/studio/books/${bookId}/editorial-profile`, label: "Editorial Profile" },
        { href: `/studio/books/${bookId}/experts`, label: "Expert Desk" },
        { href: `/studio/books/${bookId}/revisions`, label: "Revision Board" },
        { href: `/studio/books/${bookId}/exports`, label: "Exports" },
        { href: `/studio/books/${bookId}/apply-preview`, label: "Shadow Preview" },
      ]
    : [];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-black/10 pb-4 dark:border-white/10">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg border border-black/10 bg-paper px-3 py-1.5 text-sm hover:border-accent hover:text-accent dark:border-white/10"
        >
          {item.label}
        </Link>
      ))}
      {bookLinks.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg border border-black/10 bg-paper px-3 py-1.5 text-sm hover:border-accent hover:text-accent dark:border-white/10"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function StudioHeader() {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-widest text-accent">Kevin Track</p>
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Private Author Studio</h1>
      <p className="max-w-2xl text-sm text-black/55 dark:text-white/55">
        Personal manuscript development workspace. Not the commercial StoryDNA customer product.
      </p>
    </div>
  );
}
