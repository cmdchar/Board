import assert from "node:assert/strict";
import {
  createChartNode,
  createDataConnector,
  createKpiNode,
  createTransformNode,
  isDataConnector,
  runDataFlowEngine,
  wouldCreateDataFlowCycle,
} from "../src/lib/dataflow/engine.js";
import { sheetCellKey } from "../src/lib/spreadsheet/engine.js";

let seq = 0;
const uid = () => `df_${++seq}`;

function makeSheetNode() {
  return {
    id: "sheet_sales",
    type: "sheet",
    text: "Sales",
    sheetRows: 6,
    sheetCols: 3,
    sheetCells: {
      [sheetCellKey(0, 0)]: "Product",
      [sheetCellKey(0, 1)]: "Price",
      [sheetCellKey(0, 2)]: "Quantity",
      [sheetCellKey(1, 0)]: "A",
      [sheetCellKey(1, 1)]: "10",
      [sheetCellKey(1, 2)]: "2",
      [sheetCellKey(2, 0)]: "B",
      [sheetCellKey(2, 1)]: "4",
      [sheetCellKey(2, 2)]: "5",
      [sheetCellKey(3, 0)]: "C",
      [sheetCellKey(3, 1)]: "8",
      [sheetCellKey(3, 2)]: "3",
    },
  };
}

function testPipelineRuntime() {
  const sheet = makeSheetNode();
  const transform = createTransformNode({ uid, x: 420, y: 80, transformType: "sum" });
  transform.transformConfig = {
    ...transform.transformConfig,
    numericColumnIndex: 2,
  };
  const chart = createChartNode({ uid, x: 760, y: 80, chartType: "bar" });
  const kpi = createKpiNode({ uid, x: 760, y: 360, metric: "sum", title: "Total Qty" });

  const nodes = [sheet, transform, chart, kpi];
  const arrows = [
    createDataConnector({ uid, fromId: sheet.id, toId: transform.id }),
    createDataConnector({ uid, fromId: sheet.id, toId: chart.id }),
    createDataConnector({ uid, fromId: transform.id, toId: kpi.id }),
  ];

  assert.equal(isDataConnector(arrows[0]), true, "Connector should be recognized as data connector");

  const result = runDataFlowEngine({ nodes, arrows });
  const runtime = result.runtime || {};
  const patches = result.nodePatches || {};

  assert.ok(Array.isArray(runtime.dataConnectorIds), "Runtime should expose data connector ids");
  assert.equal(runtime.dataConnectorIds.length, 3, "Expected three data connectors");

  assert.ok(patches[transform.id], "Transform node should be recomputed");
  assert.equal((patches[transform.id].transformType || transform.transformType), "sum", "Transform should stay normalized");
  assert.equal(patches[transform.id].transformOutput?.kind, "number", "SUM transform should output number");
  assert.equal(Number(patches[transform.id].transformOutput?.value), 10, "Quantity SUM should be 10");

  assert.ok(patches[chart.id], "Chart node should be recomputed");
  assert.equal(Array.isArray(patches[chart.id].chartData), true, "Chart node should receive chart data");
  assert.equal(patches[chart.id].chartData.length > 0, true, "Chart should have at least one datapoint");

  assert.ok(patches[kpi.id], "KPI node should be recomputed");
  assert.equal(Number(patches[kpi.id].kpiValue), 10, "KPI should consume transform number output");

  const preview = runtime.connectorPreviewById?.[arrows[0].id];
  assert.equal(preview?.kind, "table", "Sheet output preview should be table");
}

function testCycleHelpers() {
  const t1 = createTransformNode({ uid, x: 0, y: 0, transformType: "sum" });
  const t2 = createTransformNode({ uid, x: 300, y: 0, transformType: "sum" });
  const nodes = [t1, t2];
  const arrows = [createDataConnector({ uid, fromId: t1.id, toId: t2.id })];

  assert.equal(
    wouldCreateDataFlowCycle({ nodes, arrows, fromId: t2.id, toId: t1.id }),
    true,
    "Reverse edge should be detected as a cycle",
  );
  assert.equal(
    wouldCreateDataFlowCycle({ nodes, arrows, fromId: t1.id, toId: t2.id }),
    false,
    "Existing direction should not be considered a new cycle",
  );
}

function testRuntimeCycleAndErrors() {
  const t1 = createTransformNode({ uid, x: 0, y: 0, transformType: "sum" });
  const t2 = createTransformNode({ uid, x: 300, y: 0, transformType: "sum" });
  const chart = createChartNode({ uid, x: 620, y: 0, chartType: "line" });

  const nodes = [t1, t2, chart];
  const arrows = [
    createDataConnector({ uid, fromId: t1.id, toId: t2.id }),
    createDataConnector({ uid, fromId: t2.id, toId: t1.id }),
    createDataConnector({ uid, fromId: t2.id, toId: chart.id }),
  ];

  const result = runDataFlowEngine({ nodes, arrows });
  const runtime = result.runtime || {};

  assert.equal((runtime.cycleNodeIds || []).length >= 2, true, "Cycle nodes should be reported");
  assert.equal(
    String(runtime.nodeErrorsById?.[t1.id] || "").toLowerCase().includes("cycle"),
    true,
    "Cycle node should expose cycle error",
  );
  assert.equal(
    String(runtime.connectorErrorsById?.[arrows[2].id] || "").toLowerCase().includes("no output"),
    true,
    "Downstream connector should report missing source output when source is invalid",
  );
}

function runAll() {
  testPipelineRuntime();
  testCycleHelpers();
  testRuntimeCycleAndErrors();
  console.log("dataflow engine tests: ok");
}

runAll();
