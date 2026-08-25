import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class HistoricoRecord extends FirestoreRecord {
  HistoricoRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "titulo" field.
  String? _titulo;
  String get titulo => _titulo ?? '';
  bool hasTitulo() => _titulo != null;

  // "data" field.
  DateTime? _data;
  DateTime? get data => _data;
  bool hasData() => _data != null;

  // "isSaida" field.
  bool? _isSaida;
  bool get isSaida => _isSaida ?? false;
  bool hasIsSaida() => _isSaida != null;

  // "usurario" field.
  DocumentReference? _usurario;
  DocumentReference? get usurario => _usurario;
  bool hasUsurario() => _usurario != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "estabelecimento" field.
  DocumentReference? _estabelecimento;
  DocumentReference? get estabelecimento => _estabelecimento;
  bool hasEstabelecimento() => _estabelecimento != null;

  // "nomeParceiro" field.
  String? _nomeParceiro;
  String get nomeParceiro => _nomeParceiro ?? '';
  bool hasNomeParceiro() => _nomeParceiro != null;

  void _initializeFields() {
    _titulo = snapshotData['titulo'] as String?;
    _data = snapshotData['data'] as DateTime?;
    _isSaida = snapshotData['isSaida'] as bool?;
    _usurario = snapshotData['usurario'] as DocumentReference?;
    _pontos = castToType<int>(snapshotData['pontos']);
    _estabelecimento = snapshotData['estabelecimento'] as DocumentReference?;
    _nomeParceiro = snapshotData['nomeParceiro'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('historico');

  static Stream<HistoricoRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => HistoricoRecord.fromSnapshot(s));

  static Future<HistoricoRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => HistoricoRecord.fromSnapshot(s));

  static HistoricoRecord fromSnapshot(DocumentSnapshot snapshot) =>
      HistoricoRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static HistoricoRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      HistoricoRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'HistoricoRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is HistoricoRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createHistoricoRecordData({
  String? titulo,
  DateTime? data,
  bool? isSaida,
  DocumentReference? usurario,
  int? pontos,
  DocumentReference? estabelecimento,
  String? nomeParceiro,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'titulo': titulo,
      'data': data,
      'isSaida': isSaida,
      'usurario': usurario,
      'pontos': pontos,
      'estabelecimento': estabelecimento,
      'nomeParceiro': nomeParceiro,
    }.withoutNulls,
  );

  return firestoreData;
}

class HistoricoRecordDocumentEquality implements Equality<HistoricoRecord> {
  const HistoricoRecordDocumentEquality();

  @override
  bool equals(HistoricoRecord? e1, HistoricoRecord? e2) {
    return e1?.titulo == e2?.titulo &&
        e1?.data == e2?.data &&
        e1?.isSaida == e2?.isSaida &&
        e1?.usurario == e2?.usurario &&
        e1?.pontos == e2?.pontos &&
        e1?.estabelecimento == e2?.estabelecimento &&
        e1?.nomeParceiro == e2?.nomeParceiro;
  }

  @override
  int hash(HistoricoRecord? e) => const ListEquality().hash([
        e?.titulo,
        e?.data,
        e?.isSaida,
        e?.usurario,
        e?.pontos,
        e?.estabelecimento,
        e?.nomeParceiro
      ]);

  @override
  bool isValidKey(Object? o) => o is HistoricoRecord;
}
