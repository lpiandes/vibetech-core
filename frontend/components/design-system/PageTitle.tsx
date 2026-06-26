export default function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </div>
      ) : null}

      <h1
        className={[
          eyebrow ? "mt-3" : "",
          "text-3xl font-semibold tracking-tight text-foreground",
        ].join(" ")}
      >
        {title}
      </h1>

      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

