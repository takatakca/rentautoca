import { useNavigate } from "react-router-dom";

export function DisabledVehicleBanner() {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 bg-white text-black rounded-xl px-4 py-3 flex items-center justify-between shadow-lg">
      <span className="text-sm font-medium">This vehicle is currently disabled</span>
      <button
        onClick={() => navigate("/explore")}
        className="font-bold text-sm uppercase tracking-wide"
      >
        CHANGE
      </button>
    </div>
  );
}
