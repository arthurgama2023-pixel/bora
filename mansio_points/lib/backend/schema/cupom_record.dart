import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class CupomRecord extends FirestoreRecord {
  CupomRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "cliente" field.
  DocumentReference? _cliente;
  DocumentReference? get cliente => _cliente;
  bool hasCliente() => _cliente != null;

  // "nomedocliente" field.
  String? _nomedocliente;
  String get nomedocliente => _nomedocliente ?? '';
  bool hasNomedocliente() => _nomedocliente != null;

  // "codigo" field.
  String? _codigo;
  String get codigo => _codigo ?? '';
  bool hasCodigo() => _codigo != null;

  // "cpf" field.
  String? _cpf;
  String get cpf => _cpf ?? '';
  bool hasCpf() => _cpf != null;

  // "usado" field.
  bool? _usado;
  bool get usado => _usado ?? false;
  bool hasUsado() => _usado != null;

  // "desconto" field.
  double? _desconto;
  double get desconto => _desconto ?? 0.0;
  bool hasDesconto() => _desconto != null;

  // "nome_restaurante" field.
  String? _nomeRestaurante;
  String get nomeRestaurante => _nomeRestaurante ?? '';
  bool hasNomeRestaurante() => _nomeRestaurante != null;

  // "data_usado" field.
  DateTime? _dataUsado;
  DateTime? get dataUsado => _dataUsado;
  bool hasDataUsado() => _dataUsado != null;

  // "data_troca" field.
  DateTime? _dataTroca;
  DateTime? get dataTroca => _dataTroca;
  bool hasDataTroca() => _dataTroca != null;

  // "id_restaurante" field.
  DocumentReference? _idRestaurante;
  DocumentReference? get idRestaurante => _idRestaurante;
  bool hasIdRestaurante() => _idRestaurante != null;

  DocumentReference get parentReference => reference.parent.parent!;

  void _initializeFields() {
    _cliente = snapshotData['cliente'] as DocumentReference?;
    _nomedocliente = snapshotData['nomedocliente'] as String?;
    _codigo = snapshotData['codigo'] as String?;
    _cpf = snapshotData['cpf'] as String?;
    _usado = snapshotData['usado'] as bool?;
    _desconto = castToType<double>(snapshotData['desconto']);
    _nomeRestaurante = snapshotData['nome_restaurante'] as String?;
    _dataUsado = snapshotData['data_usado'] as DateTime?;
    _dataTroca = snapshotData['data_troca'] as DateTime?;
    _idRestaurante = snapshotData['id_restaurante'] as DocumentReference?;
  }

  static Query<Map<String, dynamic>> collection([DocumentReference? parent]) =>
      parent != null
          ? parent.collection('cupom')
          : FirebaseFirestore.instance.collectionGroup('cupom');

  static DocumentReference createDoc(DocumentReference parent, {String? id}) =>
      parent.collection('cupom').doc(id);

  static Stream<CupomRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => CupomRecord.fromSnapshot(s));

  static Future<CupomRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => CupomRecord.fromSnapshot(s));

  static CupomRecord fromSnapshot(DocumentSnapshot snapshot) => CupomRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static CupomRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      CupomRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'CupomRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is CupomRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createCupomRecordData({
  DocumentReference? cliente,
  String? nomedocliente,
  String? codigo,
  String? cpf,
  bool? usado,
  double? desconto,
  String? nomeRestaurante,
  DateTime? dataUsado,
  DateTime? dataTroca,
  DocumentReference? idRestaurante,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'cliente': cliente,
      'nomedocliente': nomedocliente,
      'codigo': codigo,
      'cpf': cpf,
      'usado': usado,
      'desconto': desconto,
      'nome_restaurante': nomeRestaurante,
      'data_usado': dataUsado,
      'data_troca': dataTroca,
      'id_restaurante': idRestaurante,
    }.withoutNulls,
  );

  return firestoreData;
}

class CupomRecordDocumentEquality implements Equality<CupomRecord> {
  const CupomRecordDocumentEquality();

  @override
  bool equals(CupomRecord? e1, CupomRecord? e2) {
    return e1?.cliente == e2?.cliente &&
        e1?.nomedocliente == e2?.nomedocliente &&
        e1?.codigo == e2?.codigo &&
        e1?.cpf == e2?.cpf &&
        e1?.usado == e2?.usado &&
        e1?.desconto == e2?.desconto &&
        e1?.nomeRestaurante == e2?.nomeRestaurante &&
        e1?.dataUsado == e2?.dataUsado &&
        e1?.dataTroca == e2?.dataTroca &&
        e1?.idRestaurante == e2?.idRestaurante;
  }

  @override
  int hash(CupomRecord? e) => const ListEquality().hash([
        e?.cliente,
        e?.nomedocliente,
        e?.codigo,
        e?.cpf,
        e?.usado,
        e?.desconto,
        e?.nomeRestaurante,
        e?.dataUsado,
        e?.dataTroca,
        e?.idRestaurante
      ]);

  @override
  bool isValidKey(Object? o) => o is CupomRecord;
}
