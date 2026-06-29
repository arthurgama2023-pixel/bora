// ignore_for_file: unnecessary_getters_setters

import 'package:cloud_firestore/cloud_firestore.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class FreteStruct extends FFFirebaseStruct {
  FreteStruct({
    int? id,
    String? name,
    String? error,
    CompanyStruct? company,
    FirestoreUtilData firestoreUtilData = const FirestoreUtilData(),
  })  : _id = id,
        _name = name,
        _error = error,
        _company = company,
        super(firestoreUtilData);

  // "id" field.
  int? _id;
  int get id => _id ?? 0;
  set id(int? val) => _id = val;

  void incrementId(int amount) => id = id + amount;

  bool hasId() => _id != null;

  // "name" field.
  String? _name;
  String get name => _name ?? '';
  set name(String? val) => _name = val;

  bool hasName() => _name != null;

  // "error" field.
  String? _error;
  String get error => _error ?? '';
  set error(String? val) => _error = val;

  bool hasError() => _error != null;

  // "company" field.
  CompanyStruct? _company;
  CompanyStruct get company => _company ?? CompanyStruct();
  set company(CompanyStruct? val) => _company = val;

  void updateCompany(Function(CompanyStruct) updateFn) {
    updateFn(_company ??= CompanyStruct());
  }

  bool hasCompany() => _company != null;

  static FreteStruct fromMap(Map<String, dynamic> data) => FreteStruct(
        id: castToType<int>(data['id']),
        name: data['name'] as String?,
        error: data['error'] as String?,
        company: data['company'] is CompanyStruct
            ? data['company']
            : CompanyStruct.maybeFromMap(data['company']),
      );

  static FreteStruct? maybeFromMap(dynamic data) =>
      data is Map ? FreteStruct.fromMap(data.cast<String, dynamic>()) : null;

  Map<String, dynamic> toMap() => {
        'id': _id,
        'name': _name,
        'error': _error,
        'company': _company?.toMap(),
      }.withoutNulls;

  @override
  Map<String, dynamic> toSerializableMap() => {
        'id': serializeParam(
          _id,
          ParamType.int,
        ),
        'name': serializeParam(
          _name,
          ParamType.String,
        ),
        'error': serializeParam(
          _error,
          ParamType.String,
        ),
        'company': serializeParam(
          _company,
          ParamType.DataStruct,
        ),
      }.withoutNulls;

  static FreteStruct fromSerializableMap(Map<String, dynamic> data) =>
      FreteStruct(
        id: deserializeParam(
          data['id'],
          ParamType.int,
          false,
        ),
        name: deserializeParam(
          data['name'],
          ParamType.String,
          false,
        ),
        error: deserializeParam(
          data['error'],
          ParamType.String,
          false,
        ),
        company: deserializeStructParam(
          data['company'],
          ParamType.DataStruct,
          false,
          structBuilder: CompanyStruct.fromSerializableMap,
        ),
      );

  @override
  String toString() => 'FreteStruct(${toMap()})';

  @override
  bool operator ==(Object other) {
    return other is FreteStruct &&
        id == other.id &&
        name == other.name &&
        error == other.error &&
        company == other.company;
  }

  @override
  int get hashCode => const ListEquality().hash([id, name, error, company]);
}

FreteStruct createFreteStruct({
  int? id,
  String? name,
  String? error,
  CompanyStruct? company,
  Map<String, dynamic> fieldValues = const {},
  bool clearUnsetFields = true,
  bool create = false,
  bool delete = false,
}) =>
    FreteStruct(
      id: id,
      name: name,
      error: error,
      company: company ?? (clearUnsetFields ? CompanyStruct() : null),
      firestoreUtilData: FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
        delete: delete,
        fieldValues: fieldValues,
      ),
    );

FreteStruct? updateFreteStruct(
  FreteStruct? frete, {
  bool clearUnsetFields = true,
  bool create = false,
}) =>
    frete
      ?..firestoreUtilData = FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
      );

void addFreteStructData(
  Map<String, dynamic> firestoreData,
  FreteStruct? frete,
  String fieldName, [
  bool forFieldValue = false,
]) {
  firestoreData.remove(fieldName);
  if (frete == null) {
    return;
  }
  if (frete.firestoreUtilData.delete) {
    firestoreData[fieldName] = FieldValue.delete();
    return;
  }
  final clearFields =
      !forFieldValue && frete.firestoreUtilData.clearUnsetFields;
  if (clearFields) {
    firestoreData[fieldName] = <String, dynamic>{};
  }
  final freteData = getFreteFirestoreData(frete, forFieldValue);
  final nestedData = freteData.map((k, v) => MapEntry('$fieldName.$k', v));

  final mergeFields = frete.firestoreUtilData.create || clearFields;
  firestoreData
      .addAll(mergeFields ? mergeNestedFields(nestedData) : nestedData);
}

Map<String, dynamic> getFreteFirestoreData(
  FreteStruct? frete, [
  bool forFieldValue = false,
]) {
  if (frete == null) {
    return {};
  }
  final firestoreData = mapToFirestore(frete.toMap());

  // Handle nested data for "company" field.
  addCompanyStructData(
    firestoreData,
    frete.hasCompany() ? frete.company : null,
    'company',
    forFieldValue,
  );

  // Add any Firestore field values
  mapToFirestore(frete.firestoreUtilData.fieldValues)
      .forEach((k, v) => firestoreData[k] = v);

  return forFieldValue ? mergeNestedFields(firestoreData) : firestoreData;
}

List<Map<String, dynamic>> getFreteListFirestoreData(
  List<FreteStruct>? fretes,
) =>
    fretes?.map((e) => getFreteFirestoreData(e, true)).toList() ?? [];
