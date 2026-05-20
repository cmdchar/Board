import { createSpreadsheetEngine, sheetCellKey } from "../src/lib/spreadsheet/engine.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sheetNode({ id, name, rows = 8, cols = 6, cells = {} }) {
  return {
    id,
    type: "sheet",
    text: name,
    sheetRows: rows,
    sheetCols: cols,
    sheetCells: cells,
  };
}

function getDisplay(engine, sheetId, row, col) {
  return engine.evaluateCell(sheetId, row, col).display;
}

function runCrossSheetRefTest() {
  const nodes = [
    sheetNode({
      id: "sheet_prices",
      name: "SheetPrices",
      cells: {
        [sheetCellKey(1, 1)]: "25",
      },
    }),
    sheetNode({
      id: "sheet_qty",
      name: "SheetQty",
      cells: {
        [sheetCellKey(1, 1)]: "3",
      },
    }),
    sheetNode({
      id: "sheet_calc",
      name: "SheetCalc",
      cells: {
        [sheetCellKey(1, 1)]: "=SheetPrices!B2*SheetQty!B2",
      },
    }),
  ];
  const engine = createSpreadsheetEngine({ nodes, arrows: [] });
  assert(getDisplay(engine, "sheet_calc", 1, 1) === "75", "Cross-sheet multiplication should evaluate to 75");
  assert(engine.isDataFlowEdge("sheet_prices", "sheet_calc"), "Expected dependency edge SheetPrices -> SheetCalc");
  assert(engine.isDataFlowEdge("sheet_qty", "sheet_calc"), "Expected dependency edge SheetQty -> SheetCalc");
}

function runSheetFunctionSyntaxTest() {
  const nodes = [
    sheetNode({
      id: "s_prices",
      name: "Prices",
      cells: {
        [sheetCellKey(1, 1)]: "9",
      },
    }),
    sheetNode({
      id: "s_calc",
      name: "Calc",
      cells: {
        [sheetCellKey(1, 1)]: '=sheet("Prices").B2',
      },
    }),
  ];
  const engine = createSpreadsheetEngine({ nodes, arrows: [] });
  assert(getDisplay(engine, "s_calc", 1, 1) === "9", "sheet(\"Prices\").B2 syntax should resolve");
}

function runLookupSyntaxTest() {
  const nodes = [
    sheetNode({
      id: "sheet_table",
      name: "SheetTable",
      rows: 10,
      cols: 4,
      cells: {
        [sheetCellKey(0, 0)]: "Row",
        [sheetCellKey(0, 1)]: "Price",
        [sheetCellKey(1, 0)]: "A",
        [sheetCellKey(1, 1)]: "42",
      },
    }),
    sheetNode({
      id: "sheet_calc",
      name: "Calc",
      cells: {
        [sheetCellKey(1, 1)]: "=SheetTable!Price[A]",
      },
    }),
  ];
  const engine = createSpreadsheetEngine({ nodes, arrows: [] });
  assert(getDisplay(engine, "sheet_calc", 1, 1) === "42", "SheetTable!Price[A] should resolve to row label lookup");
}

function runRefErrorTest() {
  const nodes = [
    sheetNode({
      id: "sheet_one",
      name: "One",
      cells: {
        [sheetCellKey(1, 1)]: "=MissingSheet!B2",
      },
    }),
  ];
  const engine = createSpreadsheetEngine({ nodes, arrows: [] });
  assert(getDisplay(engine, "sheet_one", 1, 1) === "#REF!", "Missing sheet reference must return #REF!");
}

function runCycleTest() {
  const nodes = [
    sheetNode({
      id: "sheet_a",
      name: "SheetA",
      cells: {
        [sheetCellKey(1, 1)]: "=SheetB!B2",
      },
    }),
    sheetNode({
      id: "sheet_b",
      name: "SheetB",
      cells: {
        [sheetCellKey(1, 1)]: "=SheetA!B2",
      },
    }),
  ];
  const engine = createSpreadsheetEngine({ nodes, arrows: [] });
  const a = getDisplay(engine, "sheet_a", 1, 1);
  const b = getDisplay(engine, "sheet_b", 1, 1);
  assert(a === "#CYCLE!" || b === "#CYCLE!", "Circular dependency must be detected");
}

function runRecalcTest() {
  const baseNodes = [
    sheetNode({
      id: "prices",
      name: "Prices",
      cells: {
        [sheetCellKey(1, 1)]: "10",
      },
    }),
    sheetNode({
      id: "calc",
      name: "Calc",
      cells: {
        [sheetCellKey(1, 1)]: '=sheet("Prices").B2*2',
      },
    }),
  ];
  const before = createSpreadsheetEngine({ nodes: baseNodes, arrows: [] });
  assert(getDisplay(before, "calc", 1, 1) === "20", "Initial value should be 20");

  const updatedNodes = [
    sheetNode({
      id: "prices",
      name: "Prices",
      cells: {
        [sheetCellKey(1, 1)]: "15",
      },
    }),
    baseNodes[1],
  ];
  const after = createSpreadsheetEngine({ nodes: updatedNodes, arrows: [] });
  assert(getDisplay(after, "calc", 1, 1) === "30", "After source update dependent should recalculate to 30");
}

function runAll() {
  runCrossSheetRefTest();
  runSheetFunctionSyntaxTest();
  runLookupSyntaxTest();
  runRefErrorTest();
  runCycleTest();
  runRecalcTest();
  console.log("Spreadsheet engine tests: PASS");
}

runAll();
