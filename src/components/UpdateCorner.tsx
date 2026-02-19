interface UpdateCornerProps {
  updateAvailable: { version: string; body: string } | null;
  isUpdating: boolean;
  updateProgress: string;
  isCheckingUpdate: boolean;
  updateCheckResult: string | null;
  onUpdate: () => void;
  onDismiss: () => void;
  onCheck: () => void;
}

export default function UpdateCorner({ updateAvailable, isUpdating, updateProgress, isCheckingUpdate, updateCheckResult, onUpdate, onDismiss, onCheck }: UpdateCornerProps) {
  return (
    <div className="absolute top-5 right-5 flex items-center gap-2">
      {isUpdating ? (
        <span className="text-xs text-gray-500">{updateProgress || "Updating..."}</span>
      ) : updateAvailable ? (
        <>
          <button className="rounded-md border border-purple-500/50 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-500/20 transition-colors" onClick={onUpdate}>
            Update to v{updateAvailable.version}
          </button>
          <button className="rounded-md border border-gray-700 bg-transparent px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors" onClick={onDismiss}>
            Later
          </button>
        </>
      ) : (
        <>
          <button
            className="rounded-md border border-gray-700 bg-transparent px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors disabled:opacity-40"
            onClick={onCheck}
            disabled={isCheckingUpdate}
          >
            {isCheckingUpdate ? "Checking..." : "Check for Updates"}
          </button>
          {updateCheckResult && <span className="text-xs text-gray-500">{updateCheckResult}</span>}
        </>
      )}
    </div>
  );
}
