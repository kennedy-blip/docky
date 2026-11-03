import { useMemo, useState } from "react";
import { AlertTriangle, Eraser } from "lucide-react";
import type { TabId } from "./types";
import { ToastProvider, useToast } from "./context/ToastContext";
import { useFleet, formatSize } from "./hooks/useFleet";
import { composeTemplates } from "./data/mock";
import { Header } from "./components/Header";
import { ContainerFleet } from "./components/ContainerFleet";
import { DockerfileBuilder } from "./components/DockerfileBuilder";
import { ComposeVisualizer } from "./components/ComposeVisualizer";
import { RegistrySearch } from "./components/RegistrySearch";
import { Badge, Button, Modal } from "./components/ui";

function Shell() {
  const [tab, setTab] = useState<TabId>("fleet");
  const [composeYaml, setComposeYaml] = useState<string>(composeTemplates["Web Stack"]);
  const [pruneOpen, setPruneOpen] = useState(false);
  const fleet = useFleet();
  const { toast } = useToast();

  const runningCount = fleet.containers.filter((c) => c.status === "running").length;

  const pruneCandidates = useMemo(() => {
    const inUse = new Set(fleet.containers.map((c) => c.image));
    return fleet.images.filter((img) => img.dangling || !inUse.has(`${img.repository}:${img.tag}`));
  }, [fleet.containers, fleet.images]);
  const reclaimable = pruneCandidates.reduce((s, i) => s + i.sizeMb, 0);

  const confirmPrune = () => {
    const res = fleet.pruneImages();
    setPruneOpen(false);
    if (res.count === 0) toast("info", "Nothing to prune", "Total reclaimed space: 0B");
    else toast("success", `Pruned ${res.count} image${res.count === 1 ? "" : "s"}`, `Total reclaimed space: ${formatSize(res.reclaimedMb)}`);
  };

  const exportCompose = () => {
    const blob = new Blob([composeYaml], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.yml";
    a.click();
    URL.revokeObjectURL(url);
    toast("success", "Compose YAML exported", `docker-compose.yml · ${composeYaml.split("\n").length} lines`);
  };

  return (
    <div className="bg-grid min-h-screen">
      <Header active={tab} onChange={setTab} onPrune={() => setPruneOpen(true)} onExport={exportCompose} runningCount={runningCount} totalCount={fleet.containers.length} />

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6">
        <div key={tab} className="animate-fade-in">
          {tab === "fleet" && <ContainerFleet fleet={fleet} />}
          {tab === "dockerfile" && <DockerfileBuilder />}
          {tab === "compose" && <ComposeVisualizer value={composeYaml} onChange={setComposeYaml} />}
          {tab === "registry" && <RegistrySearch fleet={fleet} />}
        </div>
      </main>

      <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 pb-6 pt-2 font-mono text-[10px] text-slate-600 sm:px-6">
        <span>DockerPulse · simulated engine 24.0.7 · containerd 1.7.11 · api 1.43</span>
        <span>
          unix:///var/run/docker.sock · {fleet.containers.length} containers · {fleet.images.length} images
        </span>
      </footer>

      {/* Prune confirmation */}
      <Modal
        open={pruneOpen}
        onClose={() => setPruneOpen(false)}
        size="md"
        icon={<Eraser className="h-4 w-4" />}
        title="Prune unused images"
        subtitle={<span className="font-mono">docker image prune -a</span>}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Reclaimable: <span className="font-mono font-semibold text-emerald-300">{formatSize(reclaimable)}</span>
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPruneOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" icon={<Eraser className="h-3.5 w-3.5" />} onClick={confirmPrune} disabled={pruneCandidates.length === 0}>
                Remove {pruneCandidates.length} image{pruneCandidates.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This will remove all dangling images and every image not referenced by at least one container. Images in use are kept.</span>
          </div>
          {pruneCandidates.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No unused images. Your host is already clean ✨</div>
          ) : (
            <ul className="max-h-64 divide-y divide-line overflow-auto rounded-lg border border-line">
              {pruneCandidates.map((img) => (
                <li key={img.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs text-slate-200">
                      {img.repository}
                      <span className="text-slate-500">:</span>
                      <span className="text-sky-300">{img.tag}</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">{img.id.slice(0, 19)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {img.dangling ? <Badge tone="rose">dangling</Badge> : <Badge tone="slate">unused</Badge>}
                    <span className="w-16 text-right font-mono text-xs text-slate-300">{formatSize(img.sizeMb)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
