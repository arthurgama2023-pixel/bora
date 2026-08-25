import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ComprovantesRecord extends FirestoreRecord {
  ComprovantesRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "parceiro" field.
  DocumentReference? _parceiro;
  DocumentReference? get parceiro => _parceiro;
  bool hasParceiro() => _parceiro != null;

  // "valor" field.
  double? _valor;
  double get valor => _valor ?? 0.0;
  bool hasValor() => _valor != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "usuario" field.
  DocumentReference? _usuario;
  DocumentReference? get usuario => _usuario;
  bool hasUsuario() => _usuario != null;

  // "anexo" field.
  String? _anexo;
  String get anexo => _anexo ?? '';
  bool hasAnexo() => _anexo != null;

  void _initializeFields() {
    _parceiro = snapshotData['parceiro'] as DocumentReference?;
    _valor = castToType<double>(snapshotData['valor']);
    _pontos = castToType<int>(snapshotData['pontos']);
    _usuario = snapshotData['usuario'] as DocumentReference?;
    _anexo = snapshotData['anexo'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('comprovantes');

  static Stream<ComprovantesRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ComprovantesRecord.fromSnapshot(s));

  static Future<ComprovantesRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ComprovantesRecord.fromSnapshot(s));

  static ComprovantesRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ComprovantesRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ComprovantesRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ComprovantesRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ComprovantesRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ComprovantesRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createComprovantesRecordData({
  DocumentReference? parceiro,
  double? valor,
  int? pontos,
  DocumentReference? usuario,
  String? anexo,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'parceiro': parceiro,
      'valor': valor,
      'pontos': pontos,
      'usuario': usuario,
      'anexo': anexo,
    }.withoutNulls,
  );

  return firestoreData;
}

class ComprovantesRecordDocumentEquality
    implements Equality<ComprovantesRecord> {
  const ComprovantesRecordDocumentEquality();

  @override
  bool equals(ComprovantesRecord? e1, ComprovantesRecord? e2) {
    return e1?.parceiro == e2?.parceiro &&
        e1?.valor == e2?.valor &&
        e1?.pontos == e2?.pontos &&
        e1?.usuario == e2?.usuario &&
        e1?.anexo == e2?.anexo;
  }

  @override
  int hash(ComprovantesRecord? e) => const ListEquality()
      .hash([e?.parceiro, e?.valor, e?.pontos, e?.usuario, e?.anexo]);

  @override
  bool isValidKey(Object? o) => o is ComprovantesRecord;
}
