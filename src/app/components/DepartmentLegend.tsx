import { DEPARTMENT_COLORS, DEPARTMENTS, type Department } from "../utils/chartUtils";

interface DepartmentLegendProps {
  departments?: Department[];
}

export function DepartmentLegend({ departments = DEPARTMENTS }: DepartmentLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-200">
      {departments.map((dept) => (
        <div key={dept} className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded"
            style={{
              backgroundColor: DEPARTMENT_COLORS[dept],
              border: dept === "BIT" ? "1px solid #9CA3AF" : "none",
            }}
          />
          <span className="text-sm text-gray-700">
            {dept === "BIT" ? `${dept} (White)` : dept}
          </span>
        </div>
      ))}
    </div>
  );
}
