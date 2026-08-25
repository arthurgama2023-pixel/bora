import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AvaliacaoRecord extends FirestoreRecord {
  AvaliacaoRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "dono" field.
  DocumentReference? _dono;
  DocumentReference? get dono => _dono;
  bool hasDono() => _dono != null;

  // "data" field.
  DateTime? _data;
  DateTime? get data => _data;
  bool hasData() => _data != null;

  // "parceiro" field.
  DocumentReference? _parceiro;
  DocumentReference? get parceiro => _parceiro;
  bool hasParceiro() => _parceiro != null;

  // "texto" field.
  String? _texto;
  String get texto => _texto ?? '';
  bool hasTexto() => _texto != null;

  // "nota" field.
  double? _nota;
  double get nota => _nota ?? 0.0;
  bool hasNota() => _nota != null;

  void _initializeFields() {
    _dono = snapshotData['dono'] as DocumentReference?;
    _data = snapshotData['data'] as DateTime?;
    _parceiro = snapshotData['parceiro'] as DocumentReference?;
    _texto = snapshotData['texto'] as String?;
    _nota = castToType<double>(snapshotData['nota']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('avaliacao');

  static Stream<AvaliacaoRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AvaliacaoRecord.fromSnapshot(s));

  static Future<AvaliacaoRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => AvaliacaoRecord.fromSnapshot(s));

  static AvaliacaoRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AvaliacaoRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AvaliacaoRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AvaliacaoRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AvaliacaoRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AvaliacaoRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAvaliacaoRecordData({
  DocumentReference? dono,
  DateTime? data,
  DocumentReference? parceiro,
  String? texto,
  double? nota,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'dono': dono,
      'data': data,
      'parceiro': parceiro,
      'texto': texto,
      'nota': nota,
    }.withoutNulls,
  );

  return firestoreData;
}

class AvaliacaoRecordDocumentEquality implements Equality<AvaliacaoRecord> {
  const AvaliacaoRecordDocumentEquality();

  @override
  bool equals(AvaliacaoRecord? e1, AvaliacaoRecord? e2) {
    return e1?.dono == e2?.dono &&
        e1?.data == e2?.data &&
        e1?.parceiro == e2?.parceiro &&
        e1?.texto == e2?.texto &&
        e1?.nota == e2?.nota;
  }

  @override
  int hash(AvaliacaoRecord? e) => const ListEquality()
      .hash([e?.dono, e?.data, e?.parceiro, e?.texto, e?.nota]);

  @override
  bool isValidKey(Object? o) => o is AvaliacaoRecord;
}
