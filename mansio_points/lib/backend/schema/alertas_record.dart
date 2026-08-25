import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AlertasRecord extends FirestoreRecord {
  AlertasRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "criador" field.
  DocumentReference? _criador;
  DocumentReference? get criador => _criador;
  bool hasCriador() => _criador != null;

  // "lista" field.
  List<DocumentReference>? _lista;
  List<DocumentReference> get lista => _lista ?? const [];
  bool hasLista() => _lista != null;

  // "descricao" field.
  String? _descricao;
  String get descricao => _descricao ?? '';
  bool hasDescricao() => _descricao != null;

  // "titulo" field.
  String? _titulo;
  String get titulo => _titulo ?? '';
  bool hasTitulo() => _titulo != null;

  // "data" field.
  DateTime? _data;
  DateTime? get data => _data;
  bool hasData() => _data != null;

  // "lido" field.
  bool? _lido;
  bool get lido => _lido ?? false;
  bool hasLido() => _lido != null;

  void _initializeFields() {
    _criador = snapshotData['criador'] as DocumentReference?;
    _lista = getDataList(snapshotData['lista']);
    _descricao = snapshotData['descricao'] as String?;
    _titulo = snapshotData['titulo'] as String?;
    _data = snapshotData['data'] as DateTime?;
    _lido = snapshotData['lido'] as bool?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('alertas');

  static Stream<AlertasRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AlertasRecord.fromSnapshot(s));

  static Future<AlertasRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => AlertasRecord.fromSnapshot(s));

  static AlertasRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AlertasRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AlertasRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AlertasRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AlertasRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AlertasRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAlertasRecordData({
  DocumentReference? criador,
  String? descricao,
  String? titulo,
  DateTime? data,
  bool? lido,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'criador': criador,
      'descricao': descricao,
      'titulo': titulo,
      'data': data,
      'lido': lido,
    }.withoutNulls,
  );

  return firestoreData;
}

class AlertasRecordDocumentEquality implements Equality<AlertasRecord> {
  const AlertasRecordDocumentEquality();

  @override
  bool equals(AlertasRecord? e1, AlertasRecord? e2) {
    const listEquality = ListEquality();
    return e1?.criador == e2?.criador &&
        listEquality.equals(e1?.lista, e2?.lista) &&
        e1?.descricao == e2?.descricao &&
        e1?.titulo == e2?.titulo &&
        e1?.data == e2?.data &&
        e1?.lido == e2?.lido;
  }

  @override
  int hash(AlertasRecord? e) => const ListEquality()
      .hash([e?.criador, e?.lista, e?.descricao, e?.titulo, e?.data, e?.lido]);

  @override
  bool isValidKey(Object? o) => o is AlertasRecord;
}
