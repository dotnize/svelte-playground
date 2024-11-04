<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import type { Snippet } from "svelte";
	import type { LayoutData } from "./$types";

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex flex-col gap-4 p-4">
	<h1 class="text-4xl font-bold">Dashboard Layout</h1>
	<div class="flex items-center gap-2">
		This is a protected layout:
		<div class="rounded-md border bg-card p-1 font-mono text-card-foreground">
			routes/dashboard/+layout.svelte
		</div>
	</div>

	<div>
		User data from layout server loader
		<pre>{JSON.stringify(data.user, null, 2)}</pre>
	</div>

	<Button href="/" class="w-fit" size="lg">Back to Home</Button>

	{@render children()}
</div>
