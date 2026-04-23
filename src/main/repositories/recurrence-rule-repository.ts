import type { DatabaseManager } from "../../infra/db/database";
import type { RecurrenceRule } from "../../shared/contracts";

interface RecurrenceRuleRow {
  id: string;
  item_id: string;
  rrule_text: string;
  next_occurrence_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertRecurrenceRuleRow {
  id: string;
  itemId: string;
  rruleText: string;
  nextOccurrenceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class RecurrenceRuleRepository {
  constructor(private readonly db: DatabaseManager) {}

  getByItemId(itemId: string): RecurrenceRule | null {
    const rows = this.db.query<RecurrenceRuleRow>(
      `SELECT id, item_id, rrule_text, next_occurrence_at, created_at, updated_at
       FROM recurrence_rule
       WHERE item_id = ?`,
      [itemId]
    );

    return rows[0] ? mapRecurrenceRuleRow(rows[0]) : null;
  }

  upsert(rule: UpsertRecurrenceRuleRow): void {
    this.db.run(
      `INSERT INTO recurrence_rule (
        id, item_id, rrule_text, next_occurrence_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET
        rrule_text = excluded.rrule_text,
        next_occurrence_at = excluded.next_occurrence_at,
        updated_at = excluded.updated_at`,
      [
        rule.id,
        rule.itemId,
        rule.rruleText,
        rule.nextOccurrenceAt,
        rule.createdAt,
        rule.updatedAt,
      ]
    );
  }

  deleteByItemId(itemId: string): void {
    this.db.run("DELETE FROM recurrence_rule WHERE item_id = ?", [itemId]);
  }
}

function mapRecurrenceRuleRow(row: RecurrenceRuleRow): RecurrenceRule {
  return {
    id: row.id,
    itemId: row.item_id,
    rruleText: row.rrule_text,
    nextOccurrenceAt: row.next_occurrence_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
