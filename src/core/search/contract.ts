export type Condition<TextField extends string, IdField extends string> =
  | { attribute: TextField | IdField; filterOperator: "EQ"; value: string }
  | {
      attribute: TextField | IdField;
      filterOperator: "IN";
      value: [string, ...string[]];
    }
  | {
      attribute: TextField;
      filterOperator: "CONTAINS" | "STARTS_WITH" | "ENDS_WITH";
      value: string;
    };

export interface Group<TextField extends string, IdField extends string> {
  logicalOperator: "AND" | "OR";
  children: Filter<TextField, IdField>[];
}

export type Filter<TextField extends string, IdField extends string> =
  | Condition<TextField, IdField>
  | Group<TextField, IdField>;

export interface Sort<Field extends string> {
  attribute: Field;
  direction: "ASC" | "DESC";
}

export interface Search<
  TextField extends string,
  IdField extends string,
  SortField extends string,
> {
  filter?: Filter<TextField, IdField>;
  sort?: Sort<SortField>;
  limit: number;
}

export interface Page<T> {
  items: T[];
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset: number | null;
}
