import { randomUUID } from "node:crypto";
import { DEFAULT_WORKSPACE_ID, type DatabaseManager } from "../../infra/db/database";

interface TagRow {
  id: string;
}

export class TagRepository {
  constructor(private readonly db: DatabaseManager) {}

  attachNamesToItem(itemId: string, tagNames: string[], now: string): void {
    this.db.run("DELETE FROM item_tag WHERE item_id = ?", [itemId]);

    for (const tagName of normalizeTagNames(tagNames)) {
      const tagId = this.ensureTag(tagName, now);
      this.db.run("INSERT INTO item_tag (item_id, tag_id) VALUES (?, ?)", [itemId, tagId]);
    }
  }

  private ensureTag(name: string, now: string): string {
    const existing = this.db.query<TagRow>(
      "SELECT id FROM tag WHERE workspace_id = ? AND name = ?",
      [DEFAULT_WORKSPACE_ID, name]
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const id = randomUUID();
    this.db.run(
      `INSERT INTO tag (id, workspace_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`,
      [id, DEFAULT_WORKSPACE_ID, name, now, now]
    );
    return id;
  }
}

function normalizeTagNames(tagNames: string[]): string[] {
  return [...new Set(tagNames.map((name) => name.trim()).filter(Boolean))];
}
