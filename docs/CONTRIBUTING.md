# Contributing notes

## Radix Select empty values

Radix `Select.Item` uses the empty string internally to clear a selection and show the placeholder. Do not render app-level options as `<SelectItem value="">` or pass `value=""` to `SelectValue`; those patterns can crash once the menu opens.

Use a non-empty sentinel for "no filter", "none", or "all" options, then map that sentinel back to an empty string or `null` at the state/API boundary.

```tsx
const PROJECT_FILTER_ALL = "all";

<Select
  value={projectId || PROJECT_FILTER_ALL}
  onValueChange={(value) => setProjectId(value === PROJECT_FILTER_ALL ? "" : value)}
>
  <SelectTrigger>
    <SelectValue placeholder="All projects" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value={PROJECT_FILTER_ALL}>All projects</SelectItem>
    {projects.map((project) => (
      <SelectItem key={project.id} value={String(project.id)}>{project.title}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Before shipping Select changes, run:

```sh
rg -n '<SelectItem\s+value=""|<SelectValue\s+value=""' client/src -S
```

The command should return no matches.
